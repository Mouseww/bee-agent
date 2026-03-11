/**
 * BeeAgent Core - Re-Act Agent 实现
 */

import { DOMEngine } from '@bee-agent/dom-engine'
import { LLMClient } from '@bee-agent/llm-client'
import type { AgentConfig, AgentStatus, AgentStep, ExecutionResult, AgentMemory, ReflectionResult } from './types'
import { createTools } from './tools'
import systemPromptRaw from './prompts/system_prompt.md?raw'

const SYSTEM_PROMPT = systemPromptRaw

export class BeeAgent extends EventTarget {
  private config: Required<AgentConfig>
  private domEngine: DOMEngine
  private llmClient: LLMClient
  private status: AgentStatus = 'idle'
  private steps: AgentStep[] = []
  private abortController: AbortController | null = null
  private memory: AgentMemory = { content: [], maxItems: 10 }

  constructor(config: AgentConfig) {
    super()

    this.config = {
      maxSteps: 20,
      systemPrompt: SYSTEM_PROMPT,
      domConfig: {},
      temperature: 0.7,
      maxRetries: 3,
      timeout: 60000,
      ...config
    }

    this.domEngine = new DOMEngine(this.config.domConfig)
    this.llmClient = new LLMClient({
      baseURL: this.config.baseURL,
      apiKey: this.config.apiKey,
      model: this.config.model,
      temperature: this.config.temperature,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout
    })

    // 监听 LLM 事件
    this.llmClient.addEventListener('retry', (e: Event) => {
      this.dispatchEvent(new CustomEvent('retry', { detail: (e as CustomEvent).detail }))
    })

    this.llmClient.addEventListener('error', (e: Event) => {
      this.dispatchEvent(new CustomEvent('error', { detail: (e as CustomEvent).detail }))
    })
  }

  /**
   * 获取当前状态
   */
  getStatus(): AgentStatus {
    return this.status
  }

  /**
   * 获取步骤历史
   */
  getSteps(): AgentStep[] {
    return [...this.steps]
  }

  /**
   * 执行任务
   */
  async execute(task: string): Promise<ExecutionResult> {
    if (this.status === 'running') {
      throw new Error('Agent is already running')
    }

    this.setStatus('running')
    this.steps = []
    this.memory = { content: [], maxItems: 10 }
    this.abortController = new AbortController()

    const tools = createTools(this.domEngine)

    try {
      for (let stepIndex = 0; stepIndex < this.config.maxSteps; stepIndex++) {
        // 检查是否中止
        if (this.abortController.signal.aborted) {
          throw new Error('Task aborted')
        }

        // Observe: 获取当前页面状态
        const browserState = this.domEngine.getBrowserState()
        const observation = `${browserState.header}\n\n${browserState.content}\n\n${browserState.footer}`

        this.dispatchEvent(
          new CustomEvent('step', {
            detail: { type: 'observe', stepIndex, observation }
          })
        )

        // Think: 调用 LLM
        const messages = [
          { role: 'system' as const, content: this.config.systemPrompt },
          {
            role: 'user' as const,
            content: this.buildPrompt(task, stepIndex, observation)
          }
        ]

        const llmTools = tools.map(tool => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        }))

        this.dispatchEvent(
          new CustomEvent('step', {
            detail: { type: 'think', stepIndex }
          })
        )

        const result = await this.llmClient.invoke(
          messages,
          llmTools,
          this.abortController.signal
        )

        const thought = result.content || 'No thought provided'

        // 解析 reflection 结果
        const reflection = this.parseReflection(thought)

        // Act: 执行工具调用
        if (result.toolCalls.length === 0) {
          throw new Error('No action provided by LLM')
        }

        const toolCall = result.toolCalls[0]
        const toolName = toolCall.function.name
        const toolInput = JSON.parse(toolCall.function.arguments)

        const tool = tools.find(t => t.name === toolName)
        if (!tool) {
          throw new Error(`Unknown tool: ${toolName}`)
        }

        this.dispatchEvent(
          new CustomEvent('step', {
            detail: { type: 'act', stepIndex, action: toolName, input: toolInput }
          })
        )

        const output = await tool.execute(toolInput)

        // 更新记忆
        if (reflection?.memory) {
          this.updateMemory(reflection.memory)
        }

        // 记录步骤（包含 reflection）
        const step: AgentStep = {
          index: stepIndex,
          observation,
          thought,
          action: {
            name: toolName,
            input: toolInput,
            output
          },
          timestamp: Date.now(),
          evaluation: reflection?.evaluation,
          memory: reflection?.memory,
          nextGoal: reflection?.nextGoal
        }

        this.steps.push(step)

        this.dispatchEvent(
          new CustomEvent('step', {
            detail: { type: 'complete', stepIndex, step }
          })
        )

        // 检查是否完成
        if (toolName === 'done') {
          this.setStatus('completed')
          return {
            success: toolInput.success,
            message: toolInput.message,
            steps: this.steps
          }
        }

        // 等待一小段时间
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // 达到最大步骤数
      this.setStatus('error')
      return {
        success: false,
        message: 'Maximum steps reached',
        steps: this.steps
      }
    } catch (error) {
      this.setStatus('error')
      const message = error instanceof Error ? error.message : String(error)

      this.dispatchEvent(
        new CustomEvent('error', {
          detail: { error: message }
        })
      )

      return {
        success: false,
        message,
        steps: this.steps
      }
    } finally {
      this.domEngine.cleanup()
    }
  }

  /**
   * 停止执行
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
    this.domEngine.cleanup()
    this.setStatus('idle')
  }

  /**
   * 构建提示词（包含 reflection 和 memory）
   */
  private buildPrompt(task: string, stepIndex: number, observation: string): string {
    let prompt = `<user_request>\n${task}\n</user_request>\n\n`

    prompt += `<agent_state>\n`
    prompt += `Step ${stepIndex + 1} of ${this.config.maxSteps}\n`
    prompt += `</agent_state>\n\n`

    // 添加历史步骤（包含 reflection）
    if (this.steps.length > 0) {
      prompt += '<agent_history>\n'
      for (const step of this.steps.slice(-5)) {
        prompt += `<step_${step.index + 1}>\n`
        if (step.evaluation) {
          prompt += `Evaluation of Previous Step: ${step.evaluation}\n`
        }
        if (step.memory) {
          prompt += `Memory: ${step.memory}\n`
        }
        if (step.nextGoal) {
          prompt += `Next Goal: ${step.nextGoal}\n`
        }
        prompt += `Action Results: ${step.action.name}(${JSON.stringify(step.action.input)}) -> ${step.action.output}\n`
        prompt += `</step_${step.index + 1}>\n\n`
      }
      prompt += '</agent_history>\n\n'
    }

    // 添加累积记忆
    if (this.memory.content.length > 0) {
      prompt += '<accumulated_memory>\n'
      prompt += this.memory.content.join('\n')
      prompt += '\n</accumulated_memory>\n\n'
    }

    prompt += '<browser_state>\n'
    prompt += observation
    prompt += '\n</browser_state>\n\n'

    prompt += 'Respond with JSON format:\n'
    prompt += '{\n'
    prompt += '  "evaluation_previous_goal": "...",\n'
    prompt += '  "memory": "...",\n'
    prompt += '  "next_goal": "...",\n'
    prompt += '  "action": { "action_name": { /* params */ } }\n'
    prompt += '}'

    return prompt
  }

  /**
   * 解析 reflection 结果
   */
  private parseReflection(content: string): ReflectionResult | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null

      const parsed = JSON.parse(jsonMatch[0])
      return {
        evaluation: parsed.evaluation_previous_goal || '',
        memory: parsed.memory || '',
        nextGoal: parsed.next_goal || ''
      }
    } catch {
      return null
    }
  }

  /**
   * 更新记忆
   */
  private updateMemory(memoryText: string): void {
    if (!memoryText) return

    this.memory.content.push(memoryText)

    // 保持记忆条数限制
    if (this.memory.content.length > this.memory.maxItems) {
      this.memory.content.shift()
    }
  }

  /**
   * 设置状态
   */
  private setStatus(status: AgentStatus): void {
    if (this.status !== status) {
      this.status = status
      this.dispatchEvent(new CustomEvent('statuschange', { detail: { status } }))
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stop()
    this.domEngine.cleanup()
  }
}

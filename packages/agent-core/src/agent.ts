/**
 * BeeAgent Core - Re-Act Agent 实现
 */

import { DOMEngine } from '@bee-agent/dom-engine'
import { LLMClient } from '@bee-agent/llm-client'
import type { AgentConfig, AgentStatus, AgentStep, ExecutionResult } from './types'
import { createTools } from './tools'

const DEFAULT_SYSTEM_PROMPT = `You are BeeAgent, an AI assistant that can control web pages.

You follow the Re-Act (Reasoning and Acting) pattern:
1. Observe: Analyze the current page state
2. Think: Reason about what action to take
3. Act: Execute the action
4. Loop: Repeat until task is complete

Available actions:
- click(index): Click an element
- type(index, text): Type text into an input
- select(index, option): Select a dropdown option
- scroll(direction, pages): Scroll the page
- done(success, message): Complete the task

Always respond with:
1. Thought: Your reasoning about the current situation
2. Action: The action to take (must be one of the available actions)

When the task is complete, call done() with a summary.`

export class BeeAgent extends EventTarget {
  private config: Required<AgentConfig>
  private domEngine: DOMEngine
  private llmClient: LLMClient
  private status: AgentStatus = 'idle'
  private steps: AgentStep[] = []
  private abortController: AbortController | null = null

  constructor(config: AgentConfig) {
    super()

    this.config = {
      maxSteps: 20,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
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

        // 记录步骤
        const step: AgentStep = {
          index: stepIndex,
          observation,
          thought,
          action: {
            name: toolName,
            input: toolInput,
            output
          },
          timestamp: Date.now()
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
   * 构建提示词
   */
  private buildPrompt(task: string, stepIndex: number, observation: string): string {
    let prompt = `Task: ${task}\n\n`
    prompt += `Step ${stepIndex + 1} of ${this.config.maxSteps}\n\n`

    // 添加历史步骤
    if (this.steps.length > 0) {
      prompt += 'Previous steps:\n'
      for (const step of this.steps.slice(-3)) {
        prompt += `- Step ${step.index + 1}: ${step.action.name}(${JSON.stringify(step.action.input)}) -> ${step.action.output}\n`
      }
      prompt += '\n'
    }

    prompt += 'Current page state:\n'
    prompt += observation + '\n\n'
    prompt += 'What should I do next?'

    return prompt
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

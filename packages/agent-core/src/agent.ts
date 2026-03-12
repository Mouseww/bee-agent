/**
 * BeeAgent Core - Re-Act Agent 实现
 * @module @bee-agent/agent-core
 * @description 基于 ReAct（Reasoning and Acting）范式的浏览器自动化 Agent
 *
 * @example
 * ```ts
 * import { BeeAgent } from '@bee-agent/agent-core'
 *
 * const agent = new BeeAgent({
 *   baseURL: 'https://api.openai.com/v1',
 *   apiKey: 'sk-xxx',
 *   model: 'gpt-4'
 * })
 *
 * const result = await agent.execute('搜索最新的 TypeScript 教程')
 * console.log(result.message)
 * ```
 */

import { DOMEngine } from '@bee-agent/dom-engine'
import { LLMClient } from '@bee-agent/llm-client'
import type { AgentConfig, AgentStatus, AgentStep, ExecutionResult, AgentMemory, ReflectionResult, ToolInput } from './types'
import { createTools } from './tools'
import systemPromptRaw from './prompts/system_prompt.md?raw'

const SYSTEM_PROMPT = systemPromptRaw

/** 单步最大连续错误次数（超出则中止任务） */
const MAX_CONSECUTIVE_ERRORS = 3

/** 重复动作检测窗口大小 */
const REPEATED_ACTION_WINDOW = 4

/**
 * BeeAgent 核心类
 * @description 封装 ReAct 循环的完整生命周期：观察(Observe) → 思考(Think) → 行动(Act) → 反思(Reflect)
 * @extends EventTarget 支持事件监听：'step', 'statuschange', 'error', 'retry'
 */
export class BeeAgent extends EventTarget {
  private config: Required<Omit<AgentConfig, 'onAskUser'>> & Pick<AgentConfig, 'onAskUser'>
  private domEngine: DOMEngine
  private llmClient: LLMClient
  private status: AgentStatus = 'idle'
  private steps: AgentStep[] = []
  private abortController: AbortController | null = null
  private memory: AgentMemory = { content: [], maxItems: 10 }

  constructor(config: AgentConfig) {
    super()

    // 参数校验
    if (!config.baseURL) throw new Error('AgentConfig.baseURL is required')
    if (!config.apiKey) throw new Error('AgentConfig.apiKey is required')
    if (!config.model) throw new Error('AgentConfig.model is required')

    this.config = {
      systemPrompt: SYSTEM_PROMPT,
      domConfig: {},
      maxRetries: 3,
      timeout: 60000,
      ...config,
      // 边界值保护：maxSteps 限制在 [1, 100]，temperature 限制在 [0, 2]
      maxSteps: Math.min(Math.max(config.maxSteps ?? 20, 1), 100),
      temperature: Math.min(Math.max(config.temperature ?? 0.7, 0), 2),
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

    // 转发 LLM 事件
    this.llmClient.addEventListener('retry', (e: Event) => {
      this.dispatchEvent(new CustomEvent('retry', { detail: (e as CustomEvent).detail }))
    })

    this.llmClient.addEventListener('error', (e: Event) => {
      this.dispatchEvent(new CustomEvent('error', { detail: (e as CustomEvent).detail }))
    })
  }

  /**
   * 获取当前运行状态
   * @returns 当前 Agent 状态
   */
  getStatus(): AgentStatus {
    return this.status
  }

  /**
   * 获取所有步骤记录的副本
   * @returns 步骤历史列表
   */
  getSteps(): AgentStep[] {
    return [...this.steps]
  }

  /**
   * 执行自动化任务
   * @description 启动 ReAct 循环，直到任务完成、达到最大步骤数或被中止
   * @param task - 用户任务描述
   * @returns 执行结果
   * @throws {Error} Agent 正在运行时重复调用
   */
  async execute(task: string): Promise<ExecutionResult> {
    if (this.status === 'running') {
      throw new Error('Agent is already running')
    }

    if (!task || !task.trim()) {
      return { success: false, message: 'Task description cannot be empty', steps: [] }
    }

    this.setStatus('running')
    this.steps = []
    this.memory = { content: [], maxItems: 10 }
    this.abortController = new AbortController()

    const tools = createTools(this.domEngine, { onAskUser: this.config.onAskUser })
    let consecutiveErrors = 0

    try {
      for (let stepIndex = 0; stepIndex < this.config.maxSteps; stepIndex++) {
        // 检查是否中止
        if (this.abortController.signal.aborted) {
          throw new Error('Task aborted')
        }

        try {
          // === Observe: 获取当前页面状态 ===
          const browserState = this.domEngine.getBrowserState()
          const observation = `${browserState.header}\n\n${browserState.content}\n\n${browserState.footer}`

          this.dispatchEvent(
            new CustomEvent('step', {
              detail: { type: 'observe', stepIndex, observation }
            })
          )

          // === Think: 调用 LLM ===
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

          // === Act: 执行工具调用 ===
          if (result.toolCalls.length === 0) {
            // LLM 没有返回工具调用，记录为错误步骤但继续
            consecutiveErrors++
            const step: AgentStep = {
              index: stepIndex,
              observation,
              thought,
              action: { name: 'none', input: {}, output: '' },
              timestamp: Date.now(),
              evaluation: reflection?.evaluation,
              memory: reflection?.memory,
              nextGoal: reflection?.nextGoal,
              error: 'LLM did not provide any tool call'
            }
            this.steps.push(step)

            this.dispatchEvent(
              new CustomEvent('step', {
                detail: { type: 'error', stepIndex, error: 'No action provided by LLM' }
              })
            )

            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              this.setStatus('error')
              return {
                success: false,
                message: `Agent stopped after ${MAX_CONSECUTIVE_ERRORS} consecutive errors: LLM did not provide tool calls`,
                steps: this.steps
              }
            }
            continue
          }

          const toolCall = result.toolCalls[0]
          const toolName = toolCall.function.name

          // 安全解析工具参数
          let toolInput: ToolInput
          try {
            toolInput = JSON.parse(toolCall.function.arguments) as ToolInput
          } catch (parseError) {
            consecutiveErrors++
            const step: AgentStep = {
              index: stepIndex,
              observation,
              thought,
              action: { name: toolName, input: {}, output: '' },
              timestamp: Date.now(),
              evaluation: reflection?.evaluation,
              error: `Failed to parse tool arguments: ${toolCall.function.arguments}`
            }
            this.steps.push(step)

            this.dispatchEvent(
              new CustomEvent('step', {
                detail: { type: 'error', stepIndex, error: `JSON parse error for ${toolName} arguments` }
              })
            )

            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              this.setStatus('error')
              return {
                success: false,
                message: `Agent stopped after ${MAX_CONSECUTIVE_ERRORS} consecutive JSON parse errors`,
                steps: this.steps
              }
            }
            continue
          }

          // 查找工具
          const tool = tools.find(t => t.name === toolName)
          if (!tool) {
            consecutiveErrors++
            const step: AgentStep = {
              index: stepIndex,
              observation,
              thought,
              action: { name: toolName, input: toolInput, output: '' },
              timestamp: Date.now(),
              evaluation: reflection?.evaluation,
              error: `Unknown tool: ${toolName}. Available tools: ${tools.map(t => t.name).join(', ')}`
            }
            this.steps.push(step)

            this.dispatchEvent(
              new CustomEvent('step', {
                detail: { type: 'error', stepIndex, error: `Unknown tool: ${toolName}` }
              })
            )

            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              this.setStatus('error')
              return {
                success: false,
                message: `Agent stopped: unknown tool "${toolName}"`,
                steps: this.steps
              }
            }
            continue
          }

          // 重复动作检测
          if (this.isRepeatedAction(toolName, toolInput)) {
            this.dispatchEvent(
              new CustomEvent('step', {
                detail: { type: 'warning', stepIndex, message: `Repeated action detected: ${toolName}` }
              })
            )
          }

          this.dispatchEvent(
            new CustomEvent('step', {
              detail: { type: 'act', stepIndex, action: toolName, input: toolInput }
            })
          )

          // 执行工具（带错误处理）
          let output: string
          try {
            output = await tool.execute(toolInput)
          } catch (execError) {
            const errorMessage = execError instanceof Error ? execError.message : String(execError)
            output = `Error: ${errorMessage}`

            this.dispatchEvent(
              new CustomEvent('step', {
                detail: { type: 'error', stepIndex, error: `Tool execution error: ${errorMessage}` }
              })
            )
          }

          // 成功执行，重置连续错误计数
          consecutiveErrors = 0

          // 更新记忆
          if (reflection?.memory) {
            this.updateMemory(reflection.memory)
          }

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
              success: (toolInput as { success?: boolean }).success ?? false,
              message: String((toolInput as { message?: string }).message || 'Task completed'),
              steps: this.steps
            }
          }

          // 步骤间短暂等待（让页面有时间响应）
          await new Promise(resolve => setTimeout(resolve, 500))

        } catch (stepError) {
          // 步骤级错误恢复
          consecutiveErrors++
          const errorMessage = stepError instanceof Error ? stepError.message : String(stepError)

          // 中止错误不可恢复，直接抛出
          if (this.abortController?.signal.aborted) {
            throw stepError
          }

          this.dispatchEvent(
            new CustomEvent('step', {
              detail: { type: 'error', stepIndex, error: errorMessage }
            })
          )

          const step: AgentStep = {
            index: stepIndex,
            observation: '',
            thought: '',
            action: { name: 'error', input: {}, output: '' },
            timestamp: Date.now(),
            error: errorMessage
          }
          this.steps.push(step)

          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            this.setStatus('error')
            return {
              success: false,
              message: `Agent stopped after ${MAX_CONSECUTIVE_ERRORS} consecutive errors: ${errorMessage}`,
              steps: this.steps
            }
          }

          // 等待后继续下一步
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      // 达到最大步骤数
      this.setStatus('error')
      return {
        success: false,
        message: `Maximum steps (${this.config.maxSteps}) reached without completing the task`,
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
   * 停止当前正在执行的任务
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
    this.domEngine.cleanup()
    this.setStatus('idle')
  }

  /**
   * 检测是否出现重复动作
   * @param toolName - 当前工具名
   * @param toolInput - 当前工具参数
   * @returns 是否为重复动作
   */
  private isRepeatedAction(toolName: string, toolInput: ToolInput): boolean {
    if (this.steps.length < REPEATED_ACTION_WINDOW) return false

    const recentSteps = this.steps.slice(-REPEATED_ACTION_WINDOW)
    const currentAction = JSON.stringify({ name: toolName, input: toolInput })

    return recentSteps.every(step => {
      const stepAction = JSON.stringify({ name: step.action.name, input: step.action.input })
      return stepAction === currentAction
    })
  }

  /**
   * 构建发送给 LLM 的提示词
   * @description 包含任务描述、Agent 状态、历史步骤（含反思）、累积记忆、浏览器状态
   * @param task - 用户任务描述
   * @param stepIndex - 当前步骤索引
   * @param observation - 当前页面观察结果
   * @returns 完整的用户提示词
   */
  private buildPrompt(task: string, stepIndex: number, observation: string): string {
    let prompt = `<user_request>\n${task}\n</user_request>\n\n`

    prompt += `<agent_state>\n`
    prompt += `Step ${stepIndex + 1} of ${this.config.maxSteps}\n`
    prompt += `</agent_state>\n\n`

    // 添加历史步骤（最近 5 步，包含 reflection 和错误信息）
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
        if (step.error) {
          prompt += `Error: ${step.error}\n`
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
   * 解析 LLM 输出中的反思结构
   * @param content - LLM 输出的原始文本
   * @returns 解析后的反思结果，解析失败返回 null
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
   * 更新 FIFO 记忆队列
   * @param memoryText - 新的记忆内容
   */
  private updateMemory(memoryText: string): void {
    if (!memoryText || !memoryText.trim()) return

    this.memory.content.push(memoryText.trim())

    // 保持记忆条数限制（FIFO 淘汰最旧的）
    while (this.memory.content.length > this.memory.maxItems) {
      this.memory.content.shift()
    }
  }

  /**
   * 设置并广播状态变更
   * @param status - 新状态
   */
  private setStatus(status: AgentStatus): void {
    if (this.status !== status) {
      this.status = status
      this.dispatchEvent(new CustomEvent('statuschange', { detail: { status } }))
    }
  }

  /**
   * 清理所有资源
   * @description 停止执行、释放 DOM 引擎资源、销毁 LLM 客户端
   */
  dispose(): void {
    this.stop()
    this.domEngine.cleanup()
    if (typeof (this.llmClient as { dispose?: () => void }).dispose === 'function') {
      (this.llmClient as { dispose: () => void }).dispose()
    }
  }
}

/**
 * Watch 引擎核心
 * @module @bee-agent/agent-core/watch
 * @description 监听模式的核心调度器，协调变化检测、规则评估、LLM 调用和操作执行
 */

import { DOMEngine } from '@bee-agent/dom-engine'
import { LLMClient } from '@bee-agent/llm-client'
import type { Message, Tool } from '@bee-agent/llm-client'
import { createTools } from '../tools'
import type { AgentTool, ToolInput } from '../types'
import { ChangeDetector } from './ChangeDetector'
import { TriggerEvaluator } from './TriggerEvaluator'
import { SessionMemory } from './SessionMemory'
import { RateLimiter } from './RateLimiter'
import type {
  WatchConfig,
  WatchRule,
  WatchEngineStatus,
  WatchStats,
  WatchLogEntry,
  WatchEvent,
  PageChange,
  InteractionRecord
} from './types'

/** 默认日志最大条数 */
const DEFAULT_MAX_LOGS = 200

/** Watch 专用系统提示词 */
const WATCH_SYSTEM_PROMPT = `你是 BeeAgent 的监听模式助手。你正在持续监控网页的变化，并根据用户定义的规则自动做出响应。

你可以使用以下工具来操作页面：
- click: 点击页面元素
- type: 在输入框中输入文本
- select: 选择下拉选项
- scroll: 滚动页面
- hover: 悬停在元素上
- keyboard: 按下键盘按键
- wait: 等待一段时间
- done: 完成当前操作并记录结果

重要规则：
1. 仔细分析触发变化的内容和上下文
2. 根据规则的指令来决定操作
3. 操作完成后，必须调用 done 工具来报告结果
4. 如果判断不需要操作，也要调用 done 工具说明原因
5. 保持操作简洁高效，避免不必要的步骤`

/**
 * WatchEngine - 监听模式核心引擎
 *
 * 职责：
 * - 管理监听规则的增删改
 * - 协调 ChangeDetector、TriggerEvaluator、SessionMemory、RateLimiter
 * - 触发时构建 prompt 并调用 LLM
 * - 解析 LLM 回复并执行工具操作
 * - 维护运行状态、统计和日志
 *
 * 事件（通过 EventTarget）：
 * - 'trigger': 规则被触发
 * - 'action': 执行了操作
 * - 'error': 出错
 * - 'stats': 统计更新
 */
export class WatchEngine extends EventTarget {
  private status: WatchEngineStatus = 'idle'
  private rules: Map<string, WatchRule> = new Map()
  private logs: WatchLogEntry[] = []
  private startedAt = 0

  // 子模块
  private changeDetector: ChangeDetector
  private triggerEvaluator: TriggerEvaluator
  private sessionMemory: SessionMemory
  private rateLimiter: RateLimiter

  // LLM & 工具
  private llmClient: LLMClient
  private domEngine: DOMEngine
  private tools: AgentTool[]
  private llmTools: Tool[]

  // 内部控制
  private processing = false
  private maxLogs: number

  constructor(config: WatchConfig) {
    super()

    // 初始化 LLM 客户端
    this.llmClient = new LLMClient({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature ?? 0.3
    })

    // 初始化 DOM 引擎
    this.domEngine = new DOMEngine({ viewportExpansion: -1 })

    // 初始化工具
    this.tools = createTools(this.domEngine)
    this.llmTools = this.tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }))

    // 初始化子模块
    this.changeDetector = new ChangeDetector(
      (change) => this.handleChange(change),
      config.maxChangeBuffer
    )
    this.triggerEvaluator = new TriggerEvaluator()
    this.sessionMemory = new SessionMemory(config.maxMemoryRecords)
    this.rateLimiter = new RateLimiter(
      config.maxCallsPerMinute ?? 10,
      config.maxCallsPerHour ?? 60
    )

    this.maxLogs = DEFAULT_MAX_LOGS
  }

  // ══════════════════════════════════════
  // 公共方法
  // ══════════════════════════════════════

  /**
   * 启动监听
   */
  start(): void {
    if (this.status === 'watching') return

    this.status = 'watching'
    this.startedAt = Date.now()

    // 为所有启用的规则启动检测
    for (const rule of this.rules.values()) {
      if (rule.enabled) {
        this.changeDetector.startDetecting(rule)
      }
    }

    this.addLog('info', '监听引擎已启动')
    this.emitStats()
  }

  /**
   * 停止监听
   */
  stop(): void {
    if (this.status === 'idle') return

    this.changeDetector.stopAll()
    this.status = 'idle'

    this.addLog('info', '监听引擎已停止')
    this.emitStats()
  }

  /**
   * 暂停监听（保留检测器状态）
   */
  pause(): void {
    if (this.status !== 'watching') return

    this.changeDetector.stopAll()
    this.status = 'paused'

    this.addLog('info', '监听引擎已暂停')
    this.emitStats()
  }

  /**
   * 恢复监听
   */
  resume(): void {
    if (this.status !== 'paused') return

    this.status = 'watching'

    // 重新启动所有启用的规则检测
    for (const rule of this.rules.values()) {
      if (rule.enabled) {
        this.changeDetector.startDetecting(rule)
      }
    }

    this.addLog('info', '监听引擎已恢复')
    this.emitStats()
  }

  /**
   * 添加监听规则
   */
  addRule(rule: WatchRule): void {
    this.rules.set(rule.id, rule)
    this.addLog('info', `添加规则: ${rule.name}`, rule.id)

    // 如果引擎正在运行，立即启动检测
    if (this.status === 'watching' && rule.enabled) {
      this.changeDetector.startDetecting(rule)
    }

    this.emitStats()
  }

  /**
   * 删除监听规则
   */
  removeRule(ruleId: string): void {
    const rule = this.rules.get(ruleId)
    if (!rule) return

    this.changeDetector.stopDetecting(ruleId)
    this.rules.delete(ruleId)
    this.addLog('info', `删除规则: ${rule.name}`, ruleId)
    this.emitStats()
  }

  /**
   * 更新规则（部分更新）
   */
  updateRule(ruleId: string, patch: Partial<WatchRule>): void {
    const rule = this.rules.get(ruleId)
    if (!rule) return

    const updated = { ...rule, ...patch, id: ruleId }
    this.rules.set(ruleId, updated)

    // 如果引擎正在运行，重启该规则的检测
    if (this.status === 'watching') {
      this.changeDetector.stopDetecting(ruleId)
      if (updated.enabled) {
        this.changeDetector.startDetecting(updated)
      }
    }

    this.addLog('info', `更新规则: ${updated.name}`, ruleId)
    this.emitStats()
  }

  /**
   * 获取所有规则
   */
  getRules(): WatchRule[] {
    return Array.from(this.rules.values())
  }

  /**
   * 获取统计信息
   */
  getStats(): WatchStats {
    const rateLimitStats = this.rateLimiter.getStats()
    const ruleTriggerCounts: Record<string, number> = {}

    for (const rule of this.rules.values()) {
      ruleTriggerCounts[rule.id] = rule.triggerCount
    }

    return {
      status: this.status,
      startedAt: this.startedAt,
      uptimeMs: this.startedAt > 0 ? Date.now() - this.startedAt : 0,
      llmCallCount: rateLimitStats.totalCalls,
      totalTokens: rateLimitStats.totalTokens,
      estimatedCostUSD: rateLimitStats.estimatedCostUSD,
      ruleTriggerCounts
    }
  }

  /**
   * 获取日志
   */
  getLogs(): WatchLogEntry[] {
    return [...this.logs]
  }

  /**
   * 获取当前状态
   */
  getStatus(): WatchEngineStatus {
    return this.status
  }

  /**
   * 销毁引擎，释放资源
   */
  dispose(): void {
    this.stop()
    this.sessionMemory.clear()
    this.rateLimiter.reset()
    this.rules.clear()
    this.logs = []
    this.llmClient.dispose()
  }

  // ══════════════════════════════════════
  // 私有方法
  // ══════════════════════════════════════

  /**
   * 处理变化事件（由 ChangeDetector 回调）
   */
  private handleChange(_change: PageChange): void {
    if (this.status !== 'watching') return

    // 获取当前缓冲的变化
    const changes = this.changeDetector.flushChanges()
    if (changes.length === 0) return

    // 获取所有启用的规则
    const enabledRules = Array.from(this.rules.values()).filter(r => r.enabled)

    // 评估哪些规则应被触发
    const triggeredRules = this.triggerEvaluator.evaluate(changes, enabledRules)

    // 逐个处理触发的规则
    for (const rule of triggeredRules) {
      const matchedChanges = changes.filter(c => c.ruleId === rule.id)
      this.processTrigger(rule, matchedChanges).catch(err => {
        this.addLog('error', `处理触发出错: ${err instanceof Error ? err.message : String(err)}`, rule.id)
        this.dispatchWatchEvent({ type: 'error', ruleId: rule.id, error: String(err) })
      })
    }
  }

  /**
   * 处理单个规则的触发
   */
  private async processTrigger(rule: WatchRule, changes: PageChange[]): Promise<void> {
    // 防止并发处理同一规则
    if (this.processing) {
      this.addLog('warn', '上一个触发仍在处理中，跳过', rule.id)
      return
    }

    // 限流检查
    if (!this.rateLimiter.canCall()) {
      this.addLog('warn', '已达到 LLM 调用限制，跳过触发', rule.id)
      return
    }

    this.processing = true

    try {
      // 更新规则触发信息
      rule.triggerCount++
      rule.lastTriggeredAt = Date.now()
      this.rules.set(rule.id, rule)

      // 派发 trigger 事件
      const changeDescription = changes.map(c => c.description).join('; ')
      this.dispatchWatchEvent({
        type: 'trigger',
        rule,
        change: changes[0]
      })
      this.addLog('action', `规则触发: ${rule.name} - ${changeDescription}`, rule.id)

      // 构建 LLM prompt
      const messages = this.buildPrompt(rule, changes)

      // 调用 LLM
      const result = await this.llmClient.invoke(messages, this.llmTools)
      const tokenUsage = result.usage.totalTokens
      this.rateLimiter.recordCall(tokenUsage)

      // 解析并执行工具调用
      const actions: InteractionRecord['actions'] = []

      if (result.toolCalls && result.toolCalls.length > 0) {
        for (const toolCall of result.toolCalls) {
          const toolName = toolCall.function.name
          let toolInput: ToolInput = {}

          try {
            toolInput = JSON.parse(toolCall.function.arguments)
          } catch {
            this.addLog('error', `解析工具参数失败: ${toolCall.function.arguments}`, rule.id)
            continue
          }

          // 查找并执行工具
          const tool = this.tools.find(t => t.name === toolName)
          if (!tool) {
            this.addLog('warn', `未知工具: ${toolName}`, rule.id)
            continue
          }

          try {
            const output = await tool.execute(toolInput)
            actions.push({ tool: toolName, input: toolInput, output })
            this.addLog('action', `执行工具 ${toolName}: ${output.slice(0, 100)}`, rule.id)
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err)
            actions.push({ tool: toolName, input: toolInput, output: `Error: ${errorMsg}` })
            this.addLog('error', `工具执行失败 ${toolName}: ${errorMsg}`, rule.id)
          }
        }
      }

      // 记录交互
      const record: InteractionRecord = {
        id: `ir_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ruleId: rule.id,
        triggerReason: changeDescription,
        promptSummary: `规则: ${rule.name}, 变化: ${changeDescription.slice(0, 200)}`,
        llmResponse: result.content || '',
        actions,
        timestamp: Date.now(),
        tokenUsage
      }

      this.sessionMemory.addRecord(record)

      // 如果是新消息类型，提取消息到会话记忆
      if (rule.trigger.type === 'new_message') {
        const newMessages = this.changeDetector.extractMessages(rule.trigger)
        this.sessionMemory.addMessages(newMessages)
      }

      // 派发 action 事件
      this.dispatchWatchEvent({ type: 'action', record })
      this.emitStats()

    } finally {
      this.processing = false
    }
  }

  /**
   * 构建 LLM 调用的消息序列
   */
  private buildPrompt(rule: WatchRule, changes: PageChange[]): Message[] {
    const messages: Message[] = []

    // 系统消息
    messages.push({
      role: 'system',
      content: WATCH_SYSTEM_PROMPT
    })

    // 会话上下文
    const context = this.sessionMemory.buildContext()
    if (context) {
      messages.push({
        role: 'system',
        content: context
      })
    }

    // 用户消息：包含规则指令 + 变化内容 + 当前页面状态
    let userPrompt = `<rule>\n${rule.instruction}\n</rule>\n\n`

    // 变化内容
    userPrompt += `<changes>\n`
    for (const change of changes) {
      userPrompt += `[${change.type}] ${change.description}\n`
      if (change.content) {
        userPrompt += `内容: ${change.content.slice(0, 1000)}\n`
      }
    }
    userPrompt += `</changes>\n\n`

    // 当前页面快照
    try {
      const domSnapshot = this.domEngine.updateTree()
      userPrompt += `<current_page>\n${domSnapshot.slice(0, 3000)}\n</current_page>`
    } catch {
      userPrompt += `<current_page>\n无法获取页面快照\n</current_page>`
    }

    messages.push({
      role: 'user',
      content: userPrompt
    })

    return messages
  }

  /**
   * 添加日志条目
   */
  private addLog(level: WatchLogEntry['level'], message: string, ruleId?: string): void {
    const entry: WatchLogEntry = {
      timestamp: Date.now(),
      level,
      ruleId,
      message
    }

    this.logs.push(entry)

    // 日志数量上限保护
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }
  }

  /**
   * 派发 Watch 事件
   */
  private dispatchWatchEvent(event: WatchEvent): void {
    this.dispatchEvent(new CustomEvent(event.type, { detail: event }))
  }

  /**
   * 发送统计更新事件
   */
  private emitStats(): void {
    const stats = this.getStats()
    this.dispatchWatchEvent({ type: 'stats', stats })
  }
}

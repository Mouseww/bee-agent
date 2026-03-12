/**
 * 会话记忆管理
 * @module @bee-agent/agent-core/watch
 * @description 滑动窗口式的交互记录管理，为 LLM 提供上下文
 */

import type { InteractionRecord, NewMessage } from './types'

/** 默认最大记录数 */
const DEFAULT_MAX_RECORDS = 20

/**
 * SessionMemory - 会话记忆管理
 *
 * 职责：
 * - 维护滑动窗口的 InteractionRecord 列表
 * - 序列化为 prompt 上下文片段
 * - 提取最近的聊天消息
 */
export class SessionMemory {
  private records: InteractionRecord[] = []
  private maxRecords: number
  private recentMessages: NewMessage[] = []

  constructor(maxRecords = DEFAULT_MAX_RECORDS) {
    this.maxRecords = maxRecords
  }

  /**
   * 添加交互记录
   */
  addRecord(record: InteractionRecord): void {
    this.records.push(record)

    // 滑动窗口：超出上限时移除最早的记录
    while (this.records.length > this.maxRecords) {
      this.records.shift()
    }
  }

  /**
   * 添加最近消息（用于新消息触发场景）
   */
  addMessages(messages: NewMessage[]): void {
    this.recentMessages.push(...messages)

    // 最多保留 50 条消息
    if (this.recentMessages.length > 50) {
      this.recentMessages = this.recentMessages.slice(-50)
    }
  }

  /**
   * 获取所有记录
   */
  getRecords(): InteractionRecord[] {
    return [...this.records]
  }

  /**
   * 获取最近 N 条聊天消息
   */
  getRecentMessages(count = 10): NewMessage[] {
    return this.recentMessages.slice(-count)
  }

  /**
   * 构建 LLM 上下文 prompt 片段
   * @description 将最近的交互记录序列化为上下文信息
   */
  buildContext(maxRecords = 5): string {
    const recent = this.records.slice(-maxRecords)

    if (recent.length === 0 && this.recentMessages.length === 0) {
      return ''
    }

    let context = '<session_context>\n'

    // 添加最近的聊天消息
    if (this.recentMessages.length > 0) {
      context += '<recent_messages>\n'
      const msgs = this.recentMessages.slice(-10)
      for (const msg of msgs) {
        context += `[${new Date(msg.timestamp).toLocaleTimeString()}] ${msg.sender}: ${msg.content}\n`
      }
      context += '</recent_messages>\n\n'
    }

    // 添加交互历史
    if (recent.length > 0) {
      context += '<interaction_history>\n'
      for (const record of recent) {
        context += `[${new Date(record.timestamp).toLocaleTimeString()}] `
        context += `规则: ${record.ruleId} | 原因: ${record.triggerReason}\n`
        context += `  LLM 决策: ${record.llmResponse.slice(0, 200)}\n`
        if (record.actions.length > 0) {
          context += `  执行操作: ${record.actions.map(a => a.tool).join(', ')}\n`
        }
        context += '\n'
      }
      context += '</interaction_history>\n'
    }

    context += '</session_context>'
    return context
  }

  /**
   * 获取总 token 使用量
   */
  getTotalTokenUsage(): number {
    return this.records.reduce((sum, r) => sum + r.tokenUsage, 0)
  }

  /**
   * 清空所有记录
   */
  clear(): void {
    this.records = []
    this.recentMessages = []
  }
}

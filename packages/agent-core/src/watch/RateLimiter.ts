/**
 * 限流器
 * @module @bee-agent/agent-core/watch
 * @description 滑动窗口限流，控制 LLM 调用频率，防止过度消费
 */

/** 限流统计 */
export interface RateLimitStats {
  /** 过去一分钟内的调用次数 */
  callsLastMinute: number
  /** 过去一小时内的调用次数 */
  callsLastHour: number
  /** 每分钟上限 */
  maxPerMinute: number
  /** 每小时上限 */
  maxPerHour: number
  /** 总调用次数 */
  totalCalls: number
  /** 总 token 使用量 */
  totalTokens: number
  /** 预估费用（美元） */
  estimatedCostUSD: number
}

/** 每 1000 token 的大致费用（美元） */
const COST_PER_1K_TOKENS = 0.003

/**
 * RateLimiter - 滑动窗口限流器
 *
 * 职责：
 * - 控制每分钟 / 每小时的 LLM 调用次数
 * - 记录调用历史和 token 消耗
 * - 提供费用估算
 */
export class RateLimiter {
  private callTimestamps: number[] = []
  private maxPerMinute: number
  private maxPerHour: number
  private totalTokens = 0
  private totalCalls = 0

  constructor(maxPerMinute = 10, maxPerHour = 60) {
    this.maxPerMinute = maxPerMinute
    this.maxPerHour = maxPerHour
  }

  /**
   * 检查是否允许调用
   */
  canCall(): boolean {
    this.cleanup()
    const now = Date.now()
    const oneMinuteAgo = now - 60_000
    const oneHourAgo = now - 3_600_000

    const callsLastMinute = this.callTimestamps.filter(t => t > oneMinuteAgo).length
    const callsLastHour = this.callTimestamps.filter(t => t > oneHourAgo).length

    return callsLastMinute < this.maxPerMinute && callsLastHour < this.maxPerHour
  }

  /**
   * 记录一次调用
   */
  recordCall(tokenCount = 0): void {
    this.callTimestamps.push(Date.now())
    this.totalTokens += tokenCount
    this.totalCalls++
  }

  /**
   * 获取统计信息
   */
  getStats(): RateLimitStats {
    this.cleanup()
    const now = Date.now()
    const oneMinuteAgo = now - 60_000
    const oneHourAgo = now - 3_600_000

    return {
      callsLastMinute: this.callTimestamps.filter(t => t > oneMinuteAgo).length,
      callsLastHour: this.callTimestamps.filter(t => t > oneHourAgo).length,
      maxPerMinute: this.maxPerMinute,
      maxPerHour: this.maxPerHour,
      totalCalls: this.totalCalls,
      totalTokens: this.totalTokens,
      estimatedCostUSD: (this.totalTokens / 1000) * COST_PER_1K_TOKENS
    }
  }

  /**
   * 重置统计
   */
  reset(): void {
    this.callTimestamps = []
    this.totalTokens = 0
    this.totalCalls = 0
  }

  /**
   * 清理超过 1 小时的旧记录
   */
  private cleanup(): void {
    const oneHourAgo = Date.now() - 3_600_000
    this.callTimestamps = this.callTimestamps.filter(t => t > oneHourAgo)
  }
}

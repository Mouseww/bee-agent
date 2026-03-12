/**
 * 触发条件评估器
 * @module @bee-agent/agent-core/watch
 * @description 评估变化是否满足规则触发条件，包含冷却时间和时间窗口检查
 */

import type { WatchRule, PageChange } from './types'

/**
 * TriggerEvaluator - 触发条件评估器
 *
 * 职责：
 * - 评估变化是否匹配规则的触发条件
 * - 冷却时间检查（cooldownSeconds）
 * - activeHours 时间窗口检查
 */
export class TriggerEvaluator {
  /**
   * 评估变化是否应触发规则
   * @returns 应触发的规则列表
   */
  evaluate(changes: PageChange[], rules: WatchRule[]): WatchRule[] {
    const triggered: WatchRule[] = []
    const now = Date.now()

    for (const rule of rules) {
      if (!rule.enabled) continue

      // 冷却时间检查
      if (!this.checkCooldown(rule, now)) continue

      // 活跃时间窗口检查
      if (!this.checkActiveHours(rule)) continue

      // 匹配变化
      const hasMatchingChange = changes.some(change => change.ruleId === rule.id)
      if (hasMatchingChange) {
        triggered.push(rule)
      }
    }

    return triggered
  }

  /**
   * 检查冷却时间
   * @returns true 表示已过冷却期，可以触发
   */
  checkCooldown(rule: WatchRule, now = Date.now()): boolean {
    if (rule.cooldownSeconds <= 0) return true
    if (rule.lastTriggeredAt === 0) return true

    const elapsed = (now - rule.lastTriggeredAt) / 1000
    return elapsed >= rule.cooldownSeconds
  }

  /**
   * 检查活跃时间窗口
   * @returns true 表示当前时间在活跃窗口内
   */
  checkActiveHours(rule: WatchRule): boolean {
    if (!rule.activeHours) return true

    const match = rule.activeHours.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/)
    if (!match) return true // 格式不正确则不限制

    const startHour = parseInt(match[1], 10)
    const startMin = parseInt(match[2], 10)
    const endHour = parseInt(match[3], 10)
    const endMin = parseInt(match[4], 10)

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    // 处理跨午夜的情况 (如 22:00-06:00)
    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes
    } else {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes
    }
  }

  /**
   * 为指定变化筛选匹配的规则
   */
  matchRulesForChange(change: PageChange, rules: WatchRule[]): WatchRule[] {
    return rules.filter(rule =>
      rule.enabled &&
      rule.id === change.ruleId &&
      this.checkCooldown(rule) &&
      this.checkActiveHours(rule)
    )
  }
}

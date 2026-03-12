/**
 * Watch 模块单元测试
 * 覆盖 RateLimiter、SessionMemory、TriggerEvaluator、ChangeDetector、WatchEngine
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RateLimiter } from '../watch/RateLimiter'
import { SessionMemory } from '../watch/SessionMemory'
import { TriggerEvaluator } from '../watch/TriggerEvaluator'
import { ChangeDetector } from '../watch/ChangeDetector'
import type {
  WatchRule,
  PageChange,
  InteractionRecord,
  NewMessage,
  NewMessageTrigger
} from '../watch/types'

// ══════════════════════════════════════
// 辅助工厂函数
// ══════════════════════════════════════

function createRule(overrides: Partial<WatchRule> = {}): WatchRule {
  return {
    id: 'rule-1',
    name: '测试规则',
    enabled: true,
    trigger: { type: 'dom_change', selector: '#app', childList: true, subtree: true },
    instruction: '测试指令',
    cooldownSeconds: 10,
    triggerCount: 0,
    lastTriggeredAt: 0,
    ...overrides
  }
}

function createChange(overrides: Partial<PageChange> = {}): PageChange {
  return {
    type: 'dom_mutation',
    ruleId: 'rule-1',
    description: '子节点变化: +1 -0',
    content: '<div>test</div>',
    timestamp: Date.now(),
    ...overrides
  }
}

function createInteractionRecord(overrides: Partial<InteractionRecord> = {}): InteractionRecord {
  return {
    id: 'ir_001',
    ruleId: 'rule-1',
    triggerReason: '测试触发',
    promptSummary: '测试摘要',
    llmResponse: '测试 LLM 回复内容',
    actions: [],
    timestamp: Date.now(),
    tokenUsage: 100,
    ...overrides
  }
}

function createNewMessage(overrides: Partial<NewMessage> = {}): NewMessage {
  return {
    sender: '张三',
    content: '你好',
    timestamp: Date.now(),
    rawHTML: '<div class="message">你好</div>',
    ...overrides
  }
}

// ══════════════════════════════════════
// RateLimiter 测试
// ══════════════════════════════════════

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('基本限流逻辑', () => {
    it('初始状态应该允许调用', () => {
      const limiter = new RateLimiter(10, 60)
      expect(limiter.canCall()).toBe(true)
    })

    it('未超过每分钟上限时应该允许调用', () => {
      const limiter = new RateLimiter(3, 60)

      limiter.recordCall()
      limiter.recordCall()
      expect(limiter.canCall()).toBe(true)
    })

    it('达到每分钟上限时应该拒绝调用', () => {
      const limiter = new RateLimiter(3, 60)

      limiter.recordCall()
      limiter.recordCall()
      limiter.recordCall()
      expect(limiter.canCall()).toBe(false)
    })

    it('达到每小时上限时应该拒绝调用', () => {
      const limiter = new RateLimiter(100, 5)

      for (let i = 0; i < 5; i++) {
        limiter.recordCall()
        // 每次调用之后前进 2 分钟，确保不会触发每分钟限制
        vi.advanceTimersByTime(2 * 60 * 1000)
      }

      expect(limiter.canCall()).toBe(false)
    })
  })

  describe('冷却时间恢复', () => {
    it('超过一分钟后每分钟计数应该重置', () => {
      const limiter = new RateLimiter(2, 60)

      limiter.recordCall()
      limiter.recordCall()
      expect(limiter.canCall()).toBe(false)

      // 前进 61 秒
      vi.advanceTimersByTime(61_000)
      expect(limiter.canCall()).toBe(true)
    })

    it('超过一小时后每小时计数应该重置', () => {
      const limiter = new RateLimiter(100, 2)

      limiter.recordCall()
      limiter.recordCall()
      expect(limiter.canCall()).toBe(false)

      // 前进 1 小时 + 1 秒
      vi.advanceTimersByTime(3_600_000 + 1_000)
      expect(limiter.canCall()).toBe(true)
    })
  })

  describe('统计信息', () => {
    it('应该正确统计调用次数', () => {
      const limiter = new RateLimiter(10, 60)

      limiter.recordCall(100)
      limiter.recordCall(200)

      const stats = limiter.getStats()
      expect(stats.totalCalls).toBe(2)
      expect(stats.callsLastMinute).toBe(2)
      expect(stats.callsLastHour).toBe(2)
    })

    it('应该正确统计 token 使用量', () => {
      const limiter = new RateLimiter(10, 60)

      limiter.recordCall(100)
      limiter.recordCall(200)
      limiter.recordCall(300)

      const stats = limiter.getStats()
      expect(stats.totalTokens).toBe(600)
    })

    it('应该正确计算预估费用', () => {
      const limiter = new RateLimiter(10, 60)

      limiter.recordCall(1000)

      const stats = limiter.getStats()
      // 1000 tokens * (0.003 / 1000) = 0.003
      expect(stats.estimatedCostUSD).toBeCloseTo(0.003)
    })

    it('应该正确返回上限值', () => {
      const limiter = new RateLimiter(15, 80)

      const stats = limiter.getStats()
      expect(stats.maxPerMinute).toBe(15)
      expect(stats.maxPerHour).toBe(80)
    })

    it('过期的调用不应计入滑动窗口', () => {
      const limiter = new RateLimiter(10, 60)

      limiter.recordCall()
      vi.advanceTimersByTime(61_000)
      limiter.recordCall()

      const stats = limiter.getStats()
      expect(stats.callsLastMinute).toBe(1)
      expect(stats.totalCalls).toBe(2)
    })
  })

  describe('重置', () => {
    it('重置后所有计数应归零', () => {
      const limiter = new RateLimiter(10, 60)

      limiter.recordCall(500)
      limiter.recordCall(500)
      limiter.reset()

      const stats = limiter.getStats()
      expect(stats.totalCalls).toBe(0)
      expect(stats.totalTokens).toBe(0)
      expect(stats.callsLastMinute).toBe(0)
      expect(stats.callsLastHour).toBe(0)
      expect(limiter.canCall()).toBe(true)
    })
  })

  describe('默认参数', () => {
    it('不传参时应使用默认值 (10/分钟, 60/小时)', () => {
      const limiter = new RateLimiter()

      const stats = limiter.getStats()
      expect(stats.maxPerMinute).toBe(10)
      expect(stats.maxPerHour).toBe(60)
    })
  })

  describe('清理过期记录', () => {
    it('超过一小时的调用时间戳应被清理', () => {
      const limiter = new RateLimiter(10, 100)

      // 记录 5 次调用
      for (let i = 0; i < 5; i++) {
        limiter.recordCall()
      }

      // 前进 2 小时
      vi.advanceTimersByTime(2 * 3_600_000)

      const stats = limiter.getStats()
      expect(stats.callsLastHour).toBe(0)
      // totalCalls 不会被清理
      expect(stats.totalCalls).toBe(5)
    })
  })
})

// ══════════════════════════════════════
// SessionMemory 测试
// ══════════════════════════════════════

describe('SessionMemory', () => {
  describe('交互记录管理', () => {
    it('应该能添加和获取交互记录', () => {
      const memory = new SessionMemory()

      const record = createInteractionRecord()
      memory.addRecord(record)

      const records = memory.getRecords()
      expect(records).toHaveLength(1)
      expect(records[0].id).toBe('ir_001')
    })

    it('应该返回记录的副本（不影响内部状态）', () => {
      const memory = new SessionMemory()

      memory.addRecord(createInteractionRecord())

      const records1 = memory.getRecords()
      const records2 = memory.getRecords()
      expect(records1).not.toBe(records2)
      expect(records1).toEqual(records2)
    })

    it('超过最大记录数时应该移除最早的记录', () => {
      const memory = new SessionMemory(3)

      for (let i = 0; i < 5; i++) {
        memory.addRecord(createInteractionRecord({
          id: `ir_${i}`,
          timestamp: Date.now() + i
        }))
      }

      const records = memory.getRecords()
      expect(records).toHaveLength(3)
      expect(records[0].id).toBe('ir_2')
      expect(records[1].id).toBe('ir_3')
      expect(records[2].id).toBe('ir_4')
    })

    it('默认最大记录数应为 20', () => {
      const memory = new SessionMemory()

      for (let i = 0; i < 25; i++) {
        memory.addRecord(createInteractionRecord({ id: `ir_${i}` }))
      }

      expect(memory.getRecords()).toHaveLength(20)
    })
  })

  describe('消息管理', () => {
    it('应该能添加和获取最近消息', () => {
      const memory = new SessionMemory()

      const messages = [
        createNewMessage({ content: '消息1' }),
        createNewMessage({ content: '消息2' })
      ]
      memory.addMessages(messages)

      const recent = memory.getRecentMessages()
      expect(recent).toHaveLength(2)
    })

    it('getRecentMessages 应该返回最后 N 条', () => {
      const memory = new SessionMemory()

      const messages = Array.from({ length: 15 }, (_, i) =>
        createNewMessage({ content: `消息${i}`, timestamp: Date.now() + i })
      )
      memory.addMessages(messages)

      const recent5 = memory.getRecentMessages(5)
      expect(recent5).toHaveLength(5)
      expect(recent5[0].content).toBe('消息10')
      expect(recent5[4].content).toBe('消息14')
    })

    it('消息数量超过 50 条时应截断保留最新的', () => {
      const memory = new SessionMemory()

      const messages = Array.from({ length: 60 }, (_, i) =>
        createNewMessage({ content: `消息${i}` })
      )
      memory.addMessages(messages)

      const recent = memory.getRecentMessages(100)
      expect(recent).toHaveLength(50)
    })

    it('默认获取最近 10 条消息', () => {
      const memory = new SessionMemory()

      const messages = Array.from({ length: 20 }, (_, i) =>
        createNewMessage({ content: `消息${i}` })
      )
      memory.addMessages(messages)

      const recent = memory.getRecentMessages()
      expect(recent).toHaveLength(10)
    })
  })

  describe('buildContext', () => {
    it('没有记录和消息时应返回空字符串', () => {
      const memory = new SessionMemory()
      expect(memory.buildContext()).toBe('')
    })

    it('有消息时应包含 recent_messages 标签', () => {
      const memory = new SessionMemory()
      memory.addMessages([createNewMessage({ sender: '张三', content: '你好世界' })])

      const context = memory.buildContext()
      expect(context).toContain('<session_context>')
      expect(context).toContain('<recent_messages>')
      expect(context).toContain('张三: 你好世界')
      expect(context).toContain('</session_context>')
    })

    it('有交互记录时应包含 interaction_history 标签', () => {
      const memory = new SessionMemory()
      memory.addRecord(createInteractionRecord({
        ruleId: 'rule-1',
        triggerReason: '新消息到达',
        llmResponse: 'LLM 判断需要回复',
        actions: [{ tool: 'click', input: { ref: '1' }, output: '点击成功' }]
      }))

      const context = memory.buildContext()
      expect(context).toContain('<interaction_history>')
      expect(context).toContain('规则: rule-1')
      expect(context).toContain('原因: 新消息到达')
      expect(context).toContain('执行操作: click')
    })

    it('buildContext 的 maxRecords 参数应限制记录数', () => {
      const memory = new SessionMemory()
      for (let i = 0; i < 10; i++) {
        memory.addRecord(createInteractionRecord({
          id: `ir_${i}`,
          ruleId: `rule-${i}`
        }))
      }

      const context = memory.buildContext(2)
      // 应该只包含最后 2 条记录
      expect(context).toContain('rule-8')
      expect(context).toContain('rule-9')
      expect(context).not.toContain('rule-0')
    })

    it('LLM 回复超长时应被截断到 200 字符', () => {
      const memory = new SessionMemory()
      const longResponse = 'A'.repeat(300)
      memory.addRecord(createInteractionRecord({ llmResponse: longResponse }))

      const context = memory.buildContext()
      // buildContext 中 llmResponse.slice(0, 200)
      expect(context).toContain('A'.repeat(200))
      expect(context).not.toContain('A'.repeat(201))
    })
  })

  describe('getTotalTokenUsage', () => {
    it('应该正确统计总 token 使用量', () => {
      const memory = new SessionMemory()

      memory.addRecord(createInteractionRecord({ tokenUsage: 100 }))
      memory.addRecord(createInteractionRecord({ tokenUsage: 200 }))
      memory.addRecord(createInteractionRecord({ tokenUsage: 300 }))

      expect(memory.getTotalTokenUsage()).toBe(600)
    })

    it('没有记录时应返回 0', () => {
      const memory = new SessionMemory()
      expect(memory.getTotalTokenUsage()).toBe(0)
    })
  })

  describe('clear', () => {
    it('清空后记录和消息都应为空', () => {
      const memory = new SessionMemory()

      memory.addRecord(createInteractionRecord())
      memory.addMessages([createNewMessage()])

      memory.clear()

      expect(memory.getRecords()).toHaveLength(0)
      expect(memory.getRecentMessages()).toHaveLength(0)
      expect(memory.getTotalTokenUsage()).toBe(0)
      expect(memory.buildContext()).toBe('')
    })
  })
})

// ══════════════════════════════════════
// TriggerEvaluator 测试
// ══════════════════════════════════════

describe('TriggerEvaluator', () => {
  let evaluator: TriggerEvaluator

  beforeEach(() => {
    evaluator = new TriggerEvaluator()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('evaluate - 基本评估', () => {
    it('应该返回匹配的已启用规则', () => {
      const rules = [createRule({ id: 'rule-1' })]
      const changes = [createChange({ ruleId: 'rule-1' })]

      const triggered = evaluator.evaluate(changes, rules)
      expect(triggered).toHaveLength(1)
      expect(triggered[0].id).toBe('rule-1')
    })

    it('禁用的规则不应被触发', () => {
      const rules = [createRule({ id: 'rule-1', enabled: false })]
      const changes = [createChange({ ruleId: 'rule-1' })]

      const triggered = evaluator.evaluate(changes, rules)
      expect(triggered).toHaveLength(0)
    })

    it('没有匹配变化的规则不应被触发', () => {
      const rules = [createRule({ id: 'rule-1' })]
      const changes = [createChange({ ruleId: 'rule-2' })]

      const triggered = evaluator.evaluate(changes, rules)
      expect(triggered).toHaveLength(0)
    })

    it('应该能同时触发多个规则', () => {
      const rules = [
        createRule({ id: 'rule-1' }),
        createRule({ id: 'rule-2', name: '规则2' })
      ]
      const changes = [
        createChange({ ruleId: 'rule-1' }),
        createChange({ ruleId: 'rule-2' })
      ]

      const triggered = evaluator.evaluate(changes, rules)
      expect(triggered).toHaveLength(2)
    })
  })

  describe('checkCooldown - 冷却时间', () => {
    it('cooldownSeconds <= 0 时应始终允许', () => {
      const rule = createRule({ cooldownSeconds: 0, lastTriggeredAt: Date.now() })
      expect(evaluator.checkCooldown(rule)).toBe(true)
    })

    it('从未触发过时应允许（lastTriggeredAt === 0）', () => {
      const rule = createRule({ cooldownSeconds: 60, lastTriggeredAt: 0 })
      expect(evaluator.checkCooldown(rule)).toBe(true)
    })

    it('冷却时间未过时应拒绝', () => {
      const now = Date.now()
      const rule = createRule({
        cooldownSeconds: 60,
        lastTriggeredAt: now - 30_000 // 30 秒前触发
      })

      expect(evaluator.checkCooldown(rule, now)).toBe(false)
    })

    it('冷却时间已过时应允许', () => {
      const now = Date.now()
      const rule = createRule({
        cooldownSeconds: 60,
        lastTriggeredAt: now - 61_000 // 61 秒前触发
      })

      expect(evaluator.checkCooldown(rule, now)).toBe(true)
    })

    it('恰好等于冷却时间时应允许', () => {
      const now = Date.now()
      const rule = createRule({
        cooldownSeconds: 60,
        lastTriggeredAt: now - 60_000 // 刚好 60 秒前
      })

      expect(evaluator.checkCooldown(rule, now)).toBe(true)
    })
  })

  describe('checkActiveHours - 活跃时间窗口', () => {
    it('没有设置 activeHours 时应始终允许', () => {
      const rule = createRule({ activeHours: undefined })
      expect(evaluator.checkActiveHours(rule)).toBe(true)
    })

    it('activeHours 格式错误时应始终允许', () => {
      const rule = createRule({ activeHours: 'invalid' })
      expect(evaluator.checkActiveHours(rule)).toBe(true)
    })

    it('当前时间在活跃窗口内应允许', () => {
      // 设置当前时间为 10:30
      vi.setSystemTime(new Date('2024-01-15T10:30:00'))

      const rule = createRule({ activeHours: '09:00-18:00' })
      expect(evaluator.checkActiveHours(rule)).toBe(true)
    })

    it('当前时间在活跃窗口外应拒绝', () => {
      // 设置当前时间为 20:00
      vi.setSystemTime(new Date('2024-01-15T20:00:00'))

      const rule = createRule({ activeHours: '09:00-18:00' })
      expect(evaluator.checkActiveHours(rule)).toBe(false)
    })

    it('应该支持跨午夜的时间窗口（如 22:00-06:00）', () => {
      // 设置当前时间为 23:00 - 应该在窗口内
      vi.setSystemTime(new Date('2024-01-15T23:00:00'))
      const rule = createRule({ activeHours: '22:00-06:00' })
      expect(evaluator.checkActiveHours(rule)).toBe(true)
    })

    it('跨午夜时间窗口 - 凌晨时间应在窗口内', () => {
      // 设置当前时间为 03:00
      vi.setSystemTime(new Date('2024-01-15T03:00:00'))
      const rule = createRule({ activeHours: '22:00-06:00' })
      expect(evaluator.checkActiveHours(rule)).toBe(true)
    })

    it('跨午夜时间窗口 - 中午时间应在窗口外', () => {
      // 设置当前时间为 12:00
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))
      const rule = createRule({ activeHours: '22:00-06:00' })
      expect(evaluator.checkActiveHours(rule)).toBe(false)
    })

    it('边界时间 - 等于开始时间应在窗口内', () => {
      vi.setSystemTime(new Date('2024-01-15T09:00:00'))
      const rule = createRule({ activeHours: '09:00-18:00' })
      expect(evaluator.checkActiveHours(rule)).toBe(true)
    })

    it('边界时间 - 等于结束时间应在窗口内', () => {
      vi.setSystemTime(new Date('2024-01-15T18:00:00'))
      const rule = createRule({ activeHours: '09:00-18:00' })
      expect(evaluator.checkActiveHours(rule)).toBe(true)
    })
  })

  describe('evaluate - 综合评估（冷却 + 时间窗口 + 匹配）', () => {
    it('冷却期内的规则不应被触发', () => {
      const now = Date.now()
      const rules = [createRule({
        id: 'rule-1',
        cooldownSeconds: 60,
        lastTriggeredAt: now - 30_000
      })]
      const changes = [createChange({ ruleId: 'rule-1' })]

      const triggered = evaluator.evaluate(changes, rules)
      expect(triggered).toHaveLength(0)
    })

    it('不在活跃时间窗口内的规则不应被触发', () => {
      vi.setSystemTime(new Date('2024-01-15T20:00:00'))

      const rules = [createRule({
        id: 'rule-1',
        activeHours: '09:00-18:00'
      })]
      const changes = [createChange({ ruleId: 'rule-1' })]

      const triggered = evaluator.evaluate(changes, rules)
      expect(triggered).toHaveLength(0)
    })
  })

  describe('matchRulesForChange', () => {
    it('应该返回匹配的规则', () => {
      const change = createChange({ ruleId: 'rule-1' })
      const rules = [
        createRule({ id: 'rule-1' }),
        createRule({ id: 'rule-2' })
      ]

      const matched = evaluator.matchRulesForChange(change, rules)
      expect(matched).toHaveLength(1)
      expect(matched[0].id).toBe('rule-1')
    })

    it('禁用的规则不应被匹配', () => {
      const change = createChange({ ruleId: 'rule-1' })
      const rules = [createRule({ id: 'rule-1', enabled: false })]

      const matched = evaluator.matchRulesForChange(change, rules)
      expect(matched).toHaveLength(0)
    })
  })
})

// ══════════════════════════════════════
// ChangeDetector 测试
// ══════════════════════════════════════

describe('ChangeDetector', () => {
  let onChangeMock: ReturnType<typeof vi.fn>
  let detector: ChangeDetector
  let mockObserverInstances: Array<{
    observe: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    callback: MutationCallback
  }>

  beforeEach(() => {
    vi.useFakeTimers()
    onChangeMock = vi.fn()
    mockObserverInstances = []

    // Mock MutationObserver
    const MockMutationObserver = vi.fn().mockImplementation((callback: MutationCallback) => {
      const instance = {
        observe: vi.fn(),
        disconnect: vi.fn(),
        takeRecords: vi.fn().mockReturnValue([]),
        callback
      }
      mockObserverInstances.push(instance)
      return instance
    })
    vi.stubGlobal('MutationObserver', MockMutationObserver)

    // Mock document.querySelector
    vi.stubGlobal('document', {
      querySelector: vi.fn().mockReturnValue({
        innerHTML: '<div>test</div>',
        outerHTML: '<div id="app"><div>test</div></div>',
        innerText: 'test content',
        querySelectorAll: vi.fn().mockReturnValue([]),
        textContent: 'test'
      }),
      body: {
        innerText: 'body content',
        innerHTML: '<body>body content</body>'
      }
    })

    detector = new ChangeDetector(onChangeMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('startDetecting / stopDetecting', () => {
    it('dom_change 类型应创建 MutationObserver', () => {
      const rule = createRule({
        trigger: {
          type: 'dom_change',
          selector: '#app',
          childList: true,
          subtree: true
        }
      })

      detector.startDetecting(rule)

      expect(mockObserverInstances).toHaveLength(1)
      expect(mockObserverInstances[0].observe).toHaveBeenCalled()
    })

    it('stopDetecting 应断开观察者', () => {
      const rule = createRule({
        trigger: {
          type: 'dom_change',
          selector: '#app',
          childList: true,
          subtree: true
        }
      })

      detector.startDetecting(rule)
      detector.stopDetecting('rule-1')

      expect(mockObserverInstances[0].disconnect).toHaveBeenCalled()
    })

    it('重复启动同一规则应先停止旧检测', () => {
      const rule = createRule({
        trigger: {
          type: 'dom_change',
          selector: '#app',
          childList: true,
          subtree: true
        }
      })

      detector.startDetecting(rule)
      detector.startDetecting(rule)

      // 第一个 observer 应该被 disconnect
      expect(mockObserverInstances[0].disconnect).toHaveBeenCalled()
      // 应该创建了第二个 observer
      expect(mockObserverInstances).toHaveLength(2)
    })

    it('new_message 类型应创建 MutationObserver', () => {
      const rule = createRule({
        id: 'msg-rule',
        trigger: {
          type: 'new_message',
          containerSelector: '.chat',
          messageSelector: '.msg'
        }
      })

      detector.startDetecting(rule)
      expect(mockObserverInstances).toHaveLength(1)
    })

    it('interval 类型应创建定时器', () => {
      const rule = createRule({
        id: 'interval-rule',
        trigger: {
          type: 'interval',
          intervalSeconds: 5,
          selector: '#content'
        }
      })

      detector.startDetecting(rule)

      // 不应该创建 MutationObserver
      expect(mockObserverInstances).toHaveLength(0)
    })

    it('element_appear 类型应创建 MutationObserver 观察 document.body', () => {
      const rule = createRule({
        id: 'appear-rule',
        trigger: {
          type: 'element_appear',
          selector: '.notification',
          continuous: true
        }
      })

      detector.startDetecting(rule)
      expect(mockObserverInstances).toHaveLength(1)
    })

    it('目标元素不存在时不应创建 observer（dom_change 类型）', () => {
      // 让 querySelector 返回 null
      ;(document.querySelector as ReturnType<typeof vi.fn>).mockReturnValue(null)

      const rule = createRule({
        trigger: { type: 'dom_change', selector: '#nonexistent' }
      })

      detector.startDetecting(rule)
      expect(mockObserverInstances).toHaveLength(0)
    })
  })

  describe('stopAll', () => {
    it('应该停止所有检测器', () => {
      const rule1 = createRule({
        id: 'rule-1',
        trigger: { type: 'dom_change', selector: '#app', childList: true }
      })
      const rule2 = createRule({
        id: 'rule-2',
        trigger: { type: 'dom_change', selector: '#app2', childList: true }
      })

      detector.startDetecting(rule1)
      detector.startDetecting(rule2)
      detector.stopAll()

      for (const instance of mockObserverInstances) {
        expect(instance.disconnect).toHaveBeenCalled()
      }
    })
  })

  describe('变化缓冲区', () => {
    it('flushChanges 应返回缓冲区内容并清空', () => {
      const rule = createRule({
        trigger: { type: 'dom_change', selector: '#app', childList: true }
      })

      detector.startDetecting(rule)

      // 模拟 MutationObserver 回调触发变化
      const observerInstance = mockObserverInstances[0]
      const mockMutation = {
        type: 'childList',
        addedNodes: { length: 1 },
        removedNodes: { length: 0 }
      } as unknown as MutationRecord
      observerInstance.callback([mockMutation], observerInstance as unknown as MutationObserver)

      expect(detector.getBufferSize()).toBe(1)

      const changes = detector.flushChanges()
      expect(changes).toHaveLength(1)
      expect(changes[0].type).toBe('dom_mutation')
      expect(changes[0].ruleId).toBe('rule-1')
      expect(detector.getBufferSize()).toBe(0)
    })

    it('缓冲区应触发 onChange 回调', () => {
      const rule = createRule({
        trigger: { type: 'dom_change', selector: '#app', childList: true }
      })

      detector.startDetecting(rule)

      const observerInstance = mockObserverInstances[0]
      const mockMutation = {
        type: 'childList',
        addedNodes: { length: 1 },
        removedNodes: { length: 0 }
      } as unknown as MutationRecord
      observerInstance.callback([mockMutation], observerInstance as unknown as MutationObserver)

      expect(onChangeMock).toHaveBeenCalledTimes(1)
      expect(onChangeMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'dom_mutation',
        ruleId: 'rule-1'
      }))
    })

    it('缓冲区超过上限时应截断', () => {
      const smallBufferDetector = new ChangeDetector(onChangeMock, 3)

      const rule = createRule({
        trigger: { type: 'dom_change', selector: '#app', childList: true }
      })

      smallBufferDetector.startDetecting(rule)

      const observerInstance = mockObserverInstances[mockObserverInstances.length - 1]

      // 触发 5 次变化
      for (let i = 0; i < 5; i++) {
        const mockMutation = {
          type: 'childList',
          addedNodes: { length: 1 },
          removedNodes: { length: 0 }
        } as unknown as MutationRecord
        observerInstance.callback([mockMutation], observerInstance as unknown as MutationObserver)
      }

      expect(smallBufferDetector.getBufferSize()).toBe(3)
    })
  })

  describe('DOM 变化检测回调内容', () => {
    it('childList 变化应包含添加/移除描述', () => {
      const rule = createRule({
        trigger: { type: 'dom_change', selector: '#app', childList: true }
      })

      detector.startDetecting(rule)

      const observerInstance = mockObserverInstances[0]
      const mockMutation = {
        type: 'childList',
        addedNodes: { length: 2 },
        removedNodes: { length: 1 }
      } as unknown as MutationRecord
      observerInstance.callback([mockMutation], observerInstance as unknown as MutationObserver)

      const changes = detector.flushChanges()
      expect(changes[0].description).toContain('+2')
      expect(changes[0].description).toContain('-1')
    })

    it('attributes 变化应包含属性名', () => {
      const rule = createRule({
        trigger: { type: 'dom_change', selector: '#app', attributes: true }
      })

      detector.startDetecting(rule)

      const observerInstance = mockObserverInstances[0]
      const mockMutation = {
        type: 'attributes',
        attributeName: 'class'
      } as unknown as MutationRecord
      observerInstance.callback([mockMutation], observerInstance as unknown as MutationObserver)

      const changes = detector.flushChanges()
      expect(changes[0].description).toContain('属性变化: class')
    })

    it('characterData 变化应包含文本变化描述', () => {
      const rule = createRule({
        trigger: { type: 'dom_change', selector: '#app', characterData: true }
      })

      detector.startDetecting(rule)

      const observerInstance = mockObserverInstances[0]
      const mockMutation = {
        type: 'characterData'
      } as unknown as MutationRecord
      observerInstance.callback([mockMutation], observerInstance as unknown as MutationObserver)

      const changes = detector.flushChanges()
      expect(changes[0].description).toContain('文本变化')
    })

    it('没有实际变化的 mutation 不应推入缓冲区', () => {
      const rule = createRule({
        trigger: { type: 'dom_change', selector: '#app', childList: true }
      })

      detector.startDetecting(rule)

      const observerInstance = mockObserverInstances[0]
      const mockMutation = {
        type: 'childList',
        addedNodes: { length: 0 },
        removedNodes: { length: 0 }
      } as unknown as MutationRecord
      observerInstance.callback([mockMutation], observerInstance as unknown as MutationObserver)

      expect(detector.getBufferSize()).toBe(0)
    })
  })

  describe('定时快照对比检测', () => {
    it('快照内容变化时应推入变化', () => {
      let snapshotCount = 0
      ;(document.querySelector as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        innerHTML: '<div>test</div>',
        outerHTML: '<div>test</div>',
        innerText: snapshotCount++ === 0 ? 'initial content' : 'changed content',
        querySelectorAll: vi.fn().mockReturnValue([]),
        textContent: 'test'
      }))

      const rule = createRule({
        id: 'interval-rule',
        trigger: {
          type: 'interval',
          intervalSeconds: 5,
          selector: '#content'
        }
      })

      detector.startDetecting(rule)

      // 前进 5 秒触发定时器
      vi.advanceTimersByTime(5_000)

      const changes = detector.flushChanges()
      expect(changes).toHaveLength(1)
      expect(changes[0].type).toBe('snapshot_diff')
      expect(changes[0].ruleId).toBe('interval-rule')
    })

    it('快照内容未变化时不应推入变化', () => {
      ;(document.querySelector as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        innerHTML: '<div>test</div>',
        outerHTML: '<div>test</div>',
        innerText: 'same content',
        querySelectorAll: vi.fn().mockReturnValue([]),
        textContent: 'test'
      }))

      const rule = createRule({
        id: 'interval-rule',
        trigger: {
          type: 'interval',
          intervalSeconds: 5,
          selector: '#content'
        }
      })

      detector.startDetecting(rule)

      vi.advanceTimersByTime(5_000)

      expect(detector.getBufferSize()).toBe(0)
    })

    it('stopDetecting 应该清理定时器', () => {
      const rule = createRule({
        id: 'interval-rule',
        trigger: {
          type: 'interval',
          intervalSeconds: 5,
          selector: '#content'
        }
      })

      detector.startDetecting(rule)
      detector.stopDetecting('interval-rule')

      // 重置 mock 计数
      onChangeMock.mockClear()

      // 前进 10 秒，不应再有变化
      vi.advanceTimersByTime(10_000)
      expect(onChangeMock).not.toHaveBeenCalled()
    })
  })

  describe('extractMessages', () => {
    it('应该从消息容器中提取消息', () => {
      const mockMessages = [
        {
          textContent: '消息1',
          outerHTML: '<div class="msg">消息1</div>',
          matches: vi.fn().mockReturnValue(false),
          querySelector: vi.fn().mockReturnValue(null),
          previousElementSibling: null
        },
        {
          textContent: '消息2',
          outerHTML: '<div class="msg">消息2</div>',
          matches: vi.fn().mockReturnValue(false),
          querySelector: vi.fn().mockReturnValue(null),
          previousElementSibling: null
        }
      ]

      const mockContainer = {
        querySelectorAll: vi.fn().mockReturnValue(mockMessages)
      }

      ;(document.querySelector as ReturnType<typeof vi.fn>).mockReturnValue(mockContainer)

      const trigger: NewMessageTrigger = {
        type: 'new_message',
        containerSelector: '.chat',
        messageSelector: '.msg'
      }

      const messages = detector.extractMessages(trigger, 5)
      expect(messages).toHaveLength(2)
      expect(messages[0].content).toBe('消息1')
      expect(messages[1].content).toBe('消息2')
    })

    it('容器不存在时应返回空数组', () => {
      ;(document.querySelector as ReturnType<typeof vi.fn>).mockReturnValue(null)

      const trigger: NewMessageTrigger = {
        type: 'new_message',
        containerSelector: '.nonexistent',
        messageSelector: '.msg'
      }

      const messages = detector.extractMessages(trigger)
      expect(messages).toHaveLength(0)
    })

    it('应该排除自己发送的消息', () => {
      const mockMessages = [
        {
          textContent: '别人的消息',
          outerHTML: '<div class="msg">别人的消息</div>',
          matches: vi.fn().mockReturnValue(false),
          querySelector: vi.fn().mockReturnValue(null),
          previousElementSibling: null
        },
        {
          textContent: '自己的消息',
          outerHTML: '<div class="msg msg-self">自己的消息</div>',
          matches: vi.fn().mockReturnValue(true),
          querySelector: vi.fn().mockReturnValue(null),
          previousElementSibling: null
        }
      ]

      const mockContainer = {
        querySelectorAll: vi.fn().mockReturnValue(mockMessages)
      }

      ;(document.querySelector as ReturnType<typeof vi.fn>).mockReturnValue(mockContainer)

      const trigger: NewMessageTrigger = {
        type: 'new_message',
        containerSelector: '.chat',
        messageSelector: '.msg',
        excludeSelector: '.msg-self'
      }

      const messages = detector.extractMessages(trigger, 5)
      expect(messages).toHaveLength(1)
      expect(messages[0].content).toBe('别人的消息')
    })

    it('应该尝试从消息元素中提取发送者名称', () => {
      const senderEl = { textContent: '李四' }
      const mockMessages = [
        {
          textContent: '消息内容',
          outerHTML: '<div class="msg"><span class="sender">李四</span>消息内容</div>',
          matches: vi.fn().mockReturnValue(false),
          querySelector: vi.fn().mockImplementation((sel: string) => {
            if (sel.includes('sender')) return senderEl
            return null
          }),
          previousElementSibling: null
        }
      ]

      const mockContainer = {
        querySelectorAll: vi.fn().mockReturnValue(mockMessages)
      }

      ;(document.querySelector as ReturnType<typeof vi.fn>).mockReturnValue(mockContainer)

      const trigger: NewMessageTrigger = {
        type: 'new_message',
        containerSelector: '.chat',
        messageSelector: '.msg'
      }

      const messages = detector.extractMessages(trigger)
      expect(messages[0].sender).toBe('李四')
    })
  })
})

// ══════════════════════════════════════
// WatchEngine 测试
// ══════════════════════════════════════

// Mock 外部依赖
vi.mock('@bee-agent/dom-engine', () => ({
  DOMEngine: vi.fn().mockImplementation(() => ({
    updateTree: vi.fn().mockReturnValue('<div>page snapshot</div>'),
    cleanup: vi.fn()
  }))
}))

vi.mock('@bee-agent/llm-client', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({
      content: '执行完成',
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
    }),
    dispose: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
}))

vi.mock('../tools', () => ({
  createTools: vi.fn().mockReturnValue([])
}))

describe('WatchEngine', () => {
  // 使用动态导入避免 mock 问题
  let WatchEngine: typeof import('../watch/WatchEngine').WatchEngine

  beforeEach(async () => {
    vi.clearAllMocks()

    // Mock MutationObserver 和 document（WatchEngine 内部通过 ChangeDetector 使用）
    vi.stubGlobal('MutationObserver', vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn().mockReturnValue([])
    })))

    vi.stubGlobal('document', {
      querySelector: vi.fn().mockReturnValue({
        innerHTML: '<div>test</div>',
        outerHTML: '<div>test</div>',
        innerText: 'test',
        querySelectorAll: vi.fn().mockReturnValue([]),
        textContent: 'test'
      }),
      body: {
        innerText: 'body content',
        innerHTML: '<body></body>'
      }
    })

    // 动态导入以使 mock 生效
    const mod = await import('../watch/WatchEngine')
    WatchEngine = mod.WatchEngine
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function createEngine() {
    return new WatchEngine({
      baseURL: 'https://api.example.com',
      apiKey: 'test-key',
      model: 'gpt-4',
      maxCallsPerMinute: 10,
      maxCallsPerHour: 60
    })
  }

  describe('引擎生命周期', () => {
    it('初始状态应为 idle', () => {
      const engine = createEngine()
      expect(engine.getStatus()).toBe('idle')
    })

    it('start 后状态应变为 watching', () => {
      const engine = createEngine()
      engine.start()
      expect(engine.getStatus()).toBe('watching')
    })

    it('stop 后状态应变为 idle', () => {
      const engine = createEngine()
      engine.start()
      engine.stop()
      expect(engine.getStatus()).toBe('idle')
    })

    it('pause 后状态应变为 paused', () => {
      const engine = createEngine()
      engine.start()
      engine.pause()
      expect(engine.getStatus()).toBe('paused')
    })

    it('resume 后状态应从 paused 变为 watching', () => {
      const engine = createEngine()
      engine.start()
      engine.pause()
      engine.resume()
      expect(engine.getStatus()).toBe('watching')
    })

    it('重复 start 不应重复启动', () => {
      const engine = createEngine()
      engine.start()
      engine.start() // 重复调用
      expect(engine.getStatus()).toBe('watching')
    })

    it('idle 状态下 stop 应无效果', () => {
      const engine = createEngine()
      engine.stop()
      expect(engine.getStatus()).toBe('idle')
    })

    it('非 watching 状态下 pause 应无效果', () => {
      const engine = createEngine()
      engine.pause()
      expect(engine.getStatus()).toBe('idle')
    })

    it('非 paused 状态下 resume 应无效果', () => {
      const engine = createEngine()
      engine.resume()
      expect(engine.getStatus()).toBe('idle')
    })
  })

  describe('规则管理', () => {
    it('应该能添加规则', () => {
      const engine = createEngine()
      const rule = createRule()

      engine.addRule(rule)

      const rules = engine.getRules()
      expect(rules).toHaveLength(1)
      expect(rules[0].id).toBe('rule-1')
    })

    it('应该能删除规则', () => {
      const engine = createEngine()
      const rule = createRule()

      engine.addRule(rule)
      engine.removeRule('rule-1')

      expect(engine.getRules()).toHaveLength(0)
    })

    it('删除不存在的规则不应报错', () => {
      const engine = createEngine()
      expect(() => engine.removeRule('nonexistent')).not.toThrow()
    })

    it('应该能更新规则', () => {
      const engine = createEngine()
      const rule = createRule({ name: '原始名称' })

      engine.addRule(rule)
      engine.updateRule('rule-1', { name: '新名称' })

      const rules = engine.getRules()
      expect(rules[0].name).toBe('新名称')
    })

    it('更新规则不应改变 ID', () => {
      const engine = createEngine()
      const rule = createRule({ id: 'rule-1' })

      engine.addRule(rule)
      engine.updateRule('rule-1', { id: 'hacked-id' } as any)

      const rules = engine.getRules()
      expect(rules[0].id).toBe('rule-1')
    })

    it('更新不存在的规则不应报错', () => {
      const engine = createEngine()
      expect(() => engine.updateRule('nonexistent', { name: 'test' })).not.toThrow()
    })

    it('引擎运行时添加启用的规则应立即启动检测', () => {
      const engine = createEngine()
      engine.start()

      const rule = createRule({ enabled: true })
      engine.addRule(rule)

      // 不应报错，rule 应该被添加
      expect(engine.getRules()).toHaveLength(1)
    })

    it('引擎运行时添加禁用的规则不应启动检测', () => {
      const engine = createEngine()
      engine.start()

      const rule = createRule({ enabled: false })
      engine.addRule(rule)

      expect(engine.getRules()).toHaveLength(1)
    })
  })

  describe('统计信息', () => {
    it('初始统计应全为零', () => {
      const engine = createEngine()
      const stats = engine.getStats()

      expect(stats.status).toBe('idle')
      expect(stats.llmCallCount).toBe(0)
      expect(stats.totalTokens).toBe(0)
      expect(stats.estimatedCostUSD).toBe(0)
    })

    it('启动后统计应反映 watching 状态', () => {
      const engine = createEngine()
      engine.start()

      const stats = engine.getStats()
      expect(stats.status).toBe('watching')
      expect(stats.startedAt).toBeGreaterThan(0)
    })

    it('ruleTriggerCounts 应包含所有规则', () => {
      const engine = createEngine()
      engine.addRule(createRule({ id: 'rule-1', triggerCount: 5 }))
      engine.addRule(createRule({ id: 'rule-2', triggerCount: 3 }))

      const stats = engine.getStats()
      expect(stats.ruleTriggerCounts['rule-1']).toBe(5)
      expect(stats.ruleTriggerCounts['rule-2']).toBe(3)
    })
  })

  describe('日志', () => {
    it('start 应记录日志', () => {
      const engine = createEngine()
      engine.start()

      const logs = engine.getLogs()
      expect(logs.length).toBeGreaterThan(0)
      expect(logs.some(l => l.message.includes('启动'))).toBe(true)
    })

    it('stop 应记录日志', () => {
      const engine = createEngine()
      engine.start()
      engine.stop()

      const logs = engine.getLogs()
      expect(logs.some(l => l.message.includes('停止'))).toBe(true)
    })

    it('addRule 应记录日志', () => {
      const engine = createEngine()
      engine.addRule(createRule({ name: '测试规则XYZ' }))

      const logs = engine.getLogs()
      expect(logs.some(l => l.message.includes('测试规则XYZ'))).toBe(true)
    })

    it('removeRule 应记录日志', () => {
      const engine = createEngine()
      engine.addRule(createRule({ name: '待删除规则' }))
      engine.removeRule('rule-1')

      const logs = engine.getLogs()
      expect(logs.some(l => l.message.includes('删除规则'))).toBe(true)
    })
  })

  describe('事件', () => {
    it('start 应触发 stats 事件', () => {
      const engine = createEngine()
      const handler = vi.fn()
      engine.addEventListener('stats', handler)

      engine.start()

      expect(handler).toHaveBeenCalled()
    })

    it('stop 应触发 stats 事件', () => {
      const engine = createEngine()
      const handler = vi.fn()

      engine.start()
      engine.addEventListener('stats', handler)
      engine.stop()

      expect(handler).toHaveBeenCalled()
    })

    it('addRule 应触发 stats 事件', () => {
      const engine = createEngine()
      const handler = vi.fn()
      engine.addEventListener('stats', handler)

      engine.addRule(createRule())

      expect(handler).toHaveBeenCalled()
    })
  })

  describe('dispose', () => {
    it('应该清理所有资源', () => {
      const engine = createEngine()

      engine.addRule(createRule())
      engine.start()
      engine.dispose()

      expect(engine.getStatus()).toBe('idle')
      expect(engine.getRules()).toHaveLength(0)
      expect(engine.getLogs()).toHaveLength(0)
    })
  })
})

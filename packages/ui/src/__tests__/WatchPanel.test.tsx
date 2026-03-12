/**
 * WatchPanel 组件单元测试
 * @description 测试 Watch 面板的核心交互：渲染、Tab 切换、预设加载、规则编辑、引擎控制
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { WatchPanel } from '../WatchPanel'
import type { WatchRule, WatchStats, WatchLogEntry, WatchConfig } from '@bee-agent/agent-core'

// Mock CSS import
vi.mock('../styles.css?inline', () => ({ default: '' }))

// Mock WATCH_PRESETS
vi.mock('@bee-agent/agent-core', () => ({
  WATCH_PRESETS: [
    {
      key: 'chat_auto_reply',
      name: '聊天自动回复',
      description: '监听新消息并自动回复',
      create: () => ({
        id: 'preset_chat_1',
        name: '聊天自动回复',
        enabled: true,
        trigger: { type: 'new_message', containerSelector: '.chat', messageSelector: '.msg' },
        instruction: '自动回复',
        cooldownSeconds: 5,
        triggerCount: 0,
        lastTriggeredAt: 0
      })
    },
    {
      key: 'dom_monitor',
      name: 'DOM 变化监控',
      description: '监控页面 DOM 变化',
      create: () => ({
        id: 'preset_dom_1',
        name: 'DOM 变化监控',
        enabled: true,
        trigger: { type: 'dom_change', selector: 'body' },
        instruction: '监控变化',
        cooldownSeconds: 10,
        triggerCount: 0,
        lastTriggeredAt: 0
      })
    },
    {
      key: 'periodic_check',
      name: '定时检查',
      description: '定时检查页面变化',
      create: () => ({
        id: 'preset_periodic_1',
        name: '定时检查',
        enabled: true,
        trigger: { type: 'interval', intervalSeconds: 30 },
        instruction: '定时检查',
        cooldownSeconds: 30,
        triggerCount: 0,
        lastTriggeredAt: 0
      })
    },
    {
      key: 'element_appear',
      name: '元素出现通知',
      description: '等待特定元素出现',
      create: () => ({
        id: 'preset_element_1',
        name: '元素出现通知',
        enabled: true,
        trigger: { type: 'element_appear', selector: '.target' },
        instruction: '元素出现通知',
        cooldownSeconds: 0,
        triggerCount: 0,
        lastTriggeredAt: 0
      })
    }
  ]
}))

/** 创建 mock WatchEngine 实例 */
function createMockEngine(options: {
  status?: string
  rules?: WatchRule[]
  stats?: WatchStats | null
  logs?: WatchLogEntry[]
} = {}) {
  const listeners: Record<string, Function[]> = {}
  let currentRules = options.rules ? [...options.rules] : []

  const engine = {
    addEventListener: vi.fn((event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(handler)
    }),
    removeEventListener: vi.fn((event: string, handler: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== handler)
      }
    }),
    getStatus: vi.fn().mockReturnValue(options.status || 'idle'),
    getRules: vi.fn(() => [...currentRules]),
    getStats: vi.fn().mockReturnValue(options.stats ?? null),
    getLogs: vi.fn().mockReturnValue(options.logs || []),
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    addRule: vi.fn((rule: WatchRule) => {
      currentRules.push(rule)
    }),
    removeRule: vi.fn((ruleId: string) => {
      currentRules = currentRules.filter(r => r.id !== ruleId)
    }),
    updateRule: vi.fn((ruleId: string, updates: Partial<WatchRule>) => {
      currentRules = currentRules.map(r =>
        r.id === ruleId ? { ...r, ...updates } : r
      )
    }),
    // 测试辅助方法：触发事件
    _emit(event: string, detail: any) {
      const customEvent = new CustomEvent(event, { detail })
      listeners[event]?.forEach(h => h(customEvent))
    },
    _listeners: listeners,
    _setRules(newRules: WatchRule[]) {
      currentRules = newRules
    }
  } as any

  return engine
}

/** 创建 mock WatchConfig */
function createMockConfig(): WatchConfig {
  return {
    baseURL: 'https://api.example.com/v1',
    apiKey: 'sk-test-key',
    model: 'gpt-4'
  }
}

/** 创建示例规则 */
function createMockRule(overrides: Partial<WatchRule> = {}): WatchRule {
  return {
    id: 'rule_1',
    name: '测试规则',
    enabled: true,
    trigger: { type: 'dom_change', selector: '.target' },
    instruction: '测试指令',
    cooldownSeconds: 5,
    triggerCount: 3,
    lastTriggeredAt: Date.now() - 60000,
    ...overrides
  } as WatchRule
}

/** 创建示例统计 */
function createMockStats(overrides: Partial<WatchStats> = {}): WatchStats {
  return {
    status: 'watching',
    startedAt: Date.now() - 3600000,
    uptimeMs: 3600000,
    llmCallCount: 42,
    totalTokens: 12500,
    estimatedCostUSD: 0.0375,
    ruleTriggerCounts: {},
    ...overrides
  }
}

/** 创建示例日志 */
function createMockLog(overrides: Partial<WatchLogEntry> = {}): WatchLogEntry {
  return {
    timestamp: Date.now(),
    level: 'info',
    message: '测试日志',
    ...overrides
  }
}


describe('WatchPanel', () => {
  let engine: ReturnType<typeof createMockEngine>
  let config: WatchConfig

  beforeEach(() => {
    engine = createMockEngine()
    config = createMockConfig()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  // ══════════════════════════════════════
  // 基础渲染
  // ══════════════════════════════════════
  describe('基础渲染', () => {
    it('应该渲染 Watch 面板容器', () => {
      const { container } = render(
        <WatchPanel watchEngine={engine} watchConfig={config} />
      )
      expect(container.querySelector('.bee-watch-panel')).not.toBeNull()
    })

    it('初始状态应该显示空闲', () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)
      expect(screen.getByText('空闲')).toBeDefined()
    })

    it('应该显示状态点', () => {
      const { container } = render(
        <WatchPanel watchEngine={engine} watchConfig={config} />
      )
      const dot = container.querySelector('.bee-watch-status-dot.bee-watch-status-idle')
      expect(dot).not.toBeNull()
    })

    it('应该显示启动按钮（idle 状态）', () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)
      expect(screen.getByText('▶ 启动')).toBeDefined()
    })

    it('应该渲染三个 Tab 按钮', () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)
      expect(screen.getByText(/📋 规则/)).toBeDefined()
      expect(screen.getByText(/📊 统计/)).toBeDefined()
      expect(screen.getByText(/📝 日志/)).toBeDefined()
    })

    it('默认显示规则 Tab', () => {
      const { container } = render(
        <WatchPanel watchEngine={engine} watchConfig={config} />
      )
      const activeTab = container.querySelector('.bee-watch-tab-active')
      expect(activeTab?.textContent).toContain('规则')
    })

    it('当没有引擎时应该渲染', () => {
      const { container } = render(
        <WatchPanel watchEngine={null} watchConfig={config} />
      )
      expect(container.querySelector('.bee-watch-panel')).not.toBeNull()
      expect(screen.getByText('空闲')).toBeDefined()
    })

    it('规则为空时应该显示空状态提示', () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)
      expect(screen.getByText('暂无监听规则')).toBeDefined()
      expect(screen.getByText('点击下方按钮添加预设规则')).toBeDefined()
    })
  })

  // ══════════════════════════════════════
  // Tab 切换
  // ══════════════════════════════════════
  describe('Tab 切换', () => {
    it('点击统计 Tab 应该切换到统计面板', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText(/📊 统计/))
      })

      // 统计面板：无数据时显示空状态
      expect(screen.getByText('暂无统计数据')).toBeDefined()
      expect(screen.getByText('启动监听后将显示统计信息')).toBeDefined()
    })

    it('点击日志 Tab 应该切换到日志面板', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText(/📝 日志/))
      })

      expect(screen.getByText('暂无日志')).toBeDefined()
    })

    it('点击规则 Tab 应该切换回规则面板', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      // 切换到统计
      await act(async () => {
        fireEvent.click(screen.getByText(/📊 统计/))
      })

      // 切换回规则
      await act(async () => {
        fireEvent.click(screen.getByText(/📋 规则/))
      })

      expect(screen.getByText('暂无监听规则')).toBeDefined()
    })

    it('Tab 应该显示对应的 active 样式', async () => {
      const { container } = render(
        <WatchPanel watchEngine={engine} watchConfig={config} />
      )

      await act(async () => {
        fireEvent.click(screen.getByText(/📊 统计/))
      })

      const activeTab = container.querySelector('.bee-watch-tab-active')
      expect(activeTab?.textContent).toContain('统计')
    })

    it('规则 Tab 应该显示规则数量', () => {
      const rules = [createMockRule({ id: 'r1' }), createMockRule({ id: 'r2', name: '规则2' })]
      engine = createMockEngine({ rules })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)
      expect(screen.getByText(/📋 规则 \(2\)/)).toBeDefined()
    })

    it('日志 Tab 应该显示日志数量', () => {
      const logs = [createMockLog(), createMockLog({ message: '日志2' })]
      engine = createMockEngine({ logs })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)
      expect(screen.getByText(/📝 日志 \(2\)/)).toBeDefined()
    })
  })

  // ══════════════════════════════════════
  // 统计信息显示
  // ══════════════════════════════════════
  describe('统计信息显示', () => {
    it('有统计数据时应该显示运行时长', async () => {
      const stats = createMockStats({ uptimeMs: 7200000 }) // 2 hours
      engine = createMockEngine({ stats })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText(/📊 统计/))
      })

      expect(screen.getByText('运行时长')).toBeDefined()
      expect(screen.getByText('2h 0m')).toBeDefined()
    })

    it('有统计数据时应该显示 LLM 调用次数', async () => {
      const stats = createMockStats({ llmCallCount: 42 })
      engine = createMockEngine({ stats })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText(/📊 统计/))
      })

      expect(screen.getByText('LLM 调用')).toBeDefined()
      expect(screen.getByText('42 次')).toBeDefined()
    })

    it('有统计数据时应该显示 Token 消耗', async () => {
      const stats = createMockStats({ totalTokens: 12500 })
      engine = createMockEngine({ stats })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText(/📊 统计/))
      })

      expect(screen.getByText('Token 消耗')).toBeDefined()
      expect(screen.getByText('12,500')).toBeDefined()
    })

    it('有统计数据时应该显示预估费用', async () => {
      const stats = createMockStats({ estimatedCostUSD: 0.0375 })
      engine = createMockEngine({ stats })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText(/📊 统计/))
      })

      expect(screen.getByText('预估费用')).toBeDefined()
      expect(screen.getByText('$0.0375')).toBeDefined()
    })

    it('有规则触发次数时应该显示每个规则的触发数', async () => {
      const rules = [createMockRule({ id: 'rule_a', name: '规则A' })]
      const stats = createMockStats({ ruleTriggerCounts: { rule_a: 10 } })
      engine = createMockEngine({ rules, stats })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText(/📊 统计/))
      })

      expect(screen.getByText('规则触发次数')).toBeDefined()
      expect(screen.getByText('规则A')).toBeDefined()
      expect(screen.getByText('10')).toBeDefined()
    })

    it('状态栏应该显示运行时长（当 uptimeMs > 0）', () => {
      const stats = createMockStats({ uptimeMs: 65000 })
      engine = createMockEngine({ stats })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)
      expect(screen.getByText(/运行 1m 5s/)).toBeDefined()
    })
  })

  // ══════════════════════════════════════
  // 日志显示
  // ══════════════════════════════════════
  describe('日志显示', () => {
    it('有日志时应该显示日志列表', async () => {
      const logs = [
        createMockLog({ message: '引擎已启动', level: 'info' }),
        createMockLog({ message: '规则触发', level: 'action' })
      ]
      engine = createMockEngine({ logs })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText(/📝 日志/))
      })

      expect(screen.getByText('引擎已启动')).toBeDefined()
      expect(screen.getByText('规则触发')).toBeDefined()
    })

    it('日志应该显示级别标签', async () => {
      const logs = [
        createMockLog({ level: 'info', message: 'info日志' }),
        createMockLog({ level: 'error', message: 'error日志' }),
        createMockLog({ level: 'warn', message: 'warn日志' }),
        createMockLog({ level: 'action', message: 'action日志' })
      ]
      engine = createMockEngine({ logs })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText(/📝 日志/))
      })

      expect(screen.getByText('[info]')).toBeDefined()
      expect(screen.getByText('[error]')).toBeDefined()
      expect(screen.getByText('[warn]')).toBeDefined()
      expect(screen.getByText('[action]')).toBeDefined()
    })

    it('日志应该有正确的 CSS 类名', async () => {
      const logs = [
        createMockLog({ level: 'error', message: '错误日志' })
      ]
      engine = createMockEngine({ logs })

      const { container } = render(
        <WatchPanel watchEngine={engine} watchConfig={config} />
      )

      await act(async () => {
        fireEvent.click(screen.getByText(/📝 日志/))
      })

      expect(container.querySelector('.bee-watch-log-error')).not.toBeNull()
    })
  })

  // ══════════════════════════════════════
  // 预设规则加载
  // ══════════════════════════════════════
  describe('预设规则加载', () => {
    it('点击添加预设规则按钮应该显示预设列表', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText('+ 添加预设规则'))
      })

      expect(screen.getByText('聊天自动回复')).toBeDefined()
      expect(screen.getByText('DOM 变化监控')).toBeDefined()
      expect(screen.getByText('定时检查')).toBeDefined()
      expect(screen.getByText('元素出现通知')).toBeDefined()
    })

    it('预设应该显示描述文字', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText('+ 添加预设规则'))
      })

      expect(screen.getByText('监听新消息并自动回复')).toBeDefined()
      expect(screen.getByText('监控页面 DOM 变化')).toBeDefined()
    })

    it('点击预设项应该调用 engine.addRule', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText('+ 添加预设规则'))
      })

      await act(async () => {
        fireEvent.click(screen.getByText('聊天自动回复'))
      })

      expect(engine.addRule).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'preset_chat_1',
          name: '聊天自动回复'
        })
      )
    })

    it('添加预设后应该关闭预设列表', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText('+ 添加预设规则'))
      })

      // 预设列表可见
      expect(screen.getByText('监听新消息并自动回复')).toBeDefined()

      await act(async () => {
        fireEvent.click(screen.getByText('聊天自动回复'))
      })

      // 预设列表应该消失（描述文字不再可见）
      expect(screen.queryByText('监听新消息并自动回复')).toBeNull()
    })

    it('再次点击添加按钮应该切换预设列表显示', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      const addBtn = screen.getByText('+ 添加预设规则')

      // 打开
      await act(async () => {
        fireEvent.click(addBtn)
      })
      expect(screen.getByText('监听新消息并自动回复')).toBeDefined()

      // 关闭
      await act(async () => {
        fireEvent.click(addBtn)
      })
      expect(screen.queryByText('监听新消息并自动回复')).toBeNull()
    })
  })

  // ══════════════════════════════════════
  // 规则列表
  // ══════════════════════════════════════
  describe('规则列表', () => {
    it('应该显示规则卡片', () => {
      const rules = [createMockRule({ id: 'r1', name: '我的规则' })]
      engine = createMockEngine({ rules })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      expect(screen.getByText('我的规则')).toBeDefined()
    })

    it('应该显示规则的触发类型', () => {
      const rules = [createMockRule({ trigger: { type: 'dom_change', selector: '.test' } as any })]
      engine = createMockEngine({ rules })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      expect(screen.getByText('dom_change')).toBeDefined()
    })

    it('应该显示触发次数和冷却时间', () => {
      const rules = [createMockRule({ triggerCount: 5, cooldownSeconds: 10 })]
      engine = createMockEngine({ rules })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      expect(screen.getByText(/触发 5 次/)).toBeDefined()
      expect(screen.getByText(/冷却 10s/)).toBeDefined()
    })

    it('应该显示上次触发时间（lastTriggeredAt > 0）', () => {
      const rules = [createMockRule({ lastTriggeredAt: Date.now() })]
      engine = createMockEngine({ rules })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      expect(screen.getByText(/上次/)).toBeDefined()
    })

    it('禁用的规则应该有 disabled 样式', () => {
      const rules = [createMockRule({ enabled: false })]
      engine = createMockEngine({ rules })

      const { container } = render(
        <WatchPanel watchEngine={engine} watchConfig={config} />
      )

      expect(container.querySelector('.bee-watch-rule-disabled')).not.toBeNull()
    })

    it('启用的规则应该显示 ✅ 按钮', () => {
      const rules = [createMockRule({ enabled: true })]
      engine = createMockEngine({ rules })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      expect(screen.getByText('✅')).toBeDefined()
    })

    it('禁用的规则应该显示 ⬜ 按钮', () => {
      const rules = [createMockRule({ enabled: false })]
      engine = createMockEngine({ rules })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      expect(screen.getByText('⬜')).toBeDefined()
    })
  })

  // ══════════════════════════════════════
  // 规则操作
  // ══════════════════════════════════════
  describe('规则操作', () => {
    it('点击启用/禁用按钮应该切换规则状态', async () => {
      const rules = [createMockRule({ id: 'r1', enabled: true })]
      engine = createMockEngine({ rules })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText('✅'))
      })

      expect(engine.updateRule).toHaveBeenCalledWith('r1', { enabled: false })
    })

    it('点击删除按钮应该移除规则', async () => {
      const rules = [createMockRule({ id: 'r1', name: '待删除' })]
      engine = createMockEngine({ rules })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText('🗑️'))
      })

      expect(engine.removeRule).toHaveBeenCalledWith('r1')
    })

    it('点击编辑按钮应该打开编辑器', async () => {
      const rules = [createMockRule({ id: 'r1', name: '可编辑规则' })]
      engine = createMockEngine({ rules })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText('✏️'))
      })

      expect(screen.getByText('编辑规则')).toBeDefined()
    })
  })

  // ══════════════════════════════════════
  // 规则编辑器
  // ══════════════════════════════════════
  describe('规则编辑器', () => {
    const openEditor = async () => {
      const rules = [createMockRule({
        id: 'r1',
        name: '编辑规则名',
        instruction: '编辑指令内容',
        cooldownSeconds: 10,
        activeHours: '09:00-18:00'
      })]
      engine = createMockEngine({ rules })

      const result = render(
        <WatchPanel watchEngine={engine} watchConfig={config} />
      )

      await act(async () => {
        fireEvent.click(screen.getByText('✏️'))
      })

      return result
    }

    it('编辑器应该包含规则名称输入', async () => {
      await openEditor()

      const nameInput = screen.getByDisplayValue('编辑规则名')
      expect(nameInput).toBeDefined()
    })

    it('编辑器应该包含 AI 指令文本域', async () => {
      await openEditor()

      const textarea = screen.getByDisplayValue('编辑指令内容')
      expect(textarea).toBeDefined()
    })

    it('编辑器应该包含冷却时间输入', async () => {
      await openEditor()

      const cooldownInput = screen.getByDisplayValue('10')
      expect(cooldownInput).toBeDefined()
    })

    it('编辑器应该包含活跃时段输入', async () => {
      await openEditor()

      const activeHoursInput = screen.getByDisplayValue('09:00-18:00')
      expect(activeHoursInput).toBeDefined()
    })

    it('编辑器应该有保存和取消按钮', async () => {
      await openEditor()

      expect(screen.getByText('保存')).toBeDefined()
      expect(screen.getByText('取消')).toBeDefined()
    })

    it('修改规则名称后保存应该调用 updateRule', async () => {
      await openEditor()

      const nameInput = screen.getByDisplayValue('编辑规则名')
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: '新规则名' } })
      })

      await act(async () => {
        fireEvent.click(screen.getByText('保存'))
      })

      expect(engine.updateRule).toHaveBeenCalledWith('r1', expect.objectContaining({
        name: '新规则名'
      }))
    })

    it('修改 AI 指令后保存应该调用 updateRule', async () => {
      await openEditor()

      const textarea = screen.getByDisplayValue('编辑指令内容')
      await act(async () => {
        fireEvent.change(textarea, { target: { value: '新指令' } })
      })

      await act(async () => {
        fireEvent.click(screen.getByText('保存'))
      })

      expect(engine.updateRule).toHaveBeenCalledWith('r1', expect.objectContaining({
        instruction: '新指令'
      }))
    })

    it('保存后编辑器应该关闭', async () => {
      await openEditor()

      await act(async () => {
        fireEvent.click(screen.getByText('保存'))
      })

      expect(screen.queryByText('编辑规则')).toBeNull()
    })

    it('点击取消应该关闭编辑器', async () => {
      await openEditor()

      await act(async () => {
        fireEvent.click(screen.getByText('取消'))
      })

      expect(screen.queryByText('编辑规则')).toBeNull()
    })

    it('编辑器应该显示标签文字', async () => {
      await openEditor()

      expect(screen.getByText('规则名称')).toBeDefined()
      expect(screen.getByText('AI 指令')).toBeDefined()
      expect(screen.getByText('冷却时间（秒）')).toBeDefined()
    })
  })

  // ══════════════════════════════════════
  // 引擎控制（启动/暂停/恢复/停止）
  // ══════════════════════════════════════
  describe('引擎控制', () => {
    it('idle 状态下点击启动应该调用 engine.start', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        fireEvent.click(screen.getByText('▶ 启动'))
      })

      expect(engine.start).toHaveBeenCalledOnce()
    })

    it('watching 状态下应该显示暂停和停止按钮', async () => {
      engine.getStatus.mockReturnValue('watching')

      const { container } = render(
        <WatchPanel watchEngine={engine} watchConfig={config} />
      )

      // 通过 stats 事件更新状态为 watching
      await act(async () => {
        engine._emit('stats', {
          stats: createMockStats({ status: 'watching', uptimeMs: 1000 })
        })
      })

      expect(screen.getByText('⏸ 暂停')).toBeDefined()
      expect(screen.getByText('⏹ 停止')).toBeDefined()
    })

    it('watching 状态下点击暂停应该调用 engine.pause', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        engine._emit('stats', {
          stats: createMockStats({ status: 'watching', uptimeMs: 1000 })
        })
      })

      await act(async () => {
        fireEvent.click(screen.getByText('⏸ 暂停'))
      })

      expect(engine.pause).toHaveBeenCalledOnce()
    })

    it('watching 状态下点击停止应该调用 engine.stop', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        engine._emit('stats', {
          stats: createMockStats({ status: 'watching', uptimeMs: 1000 })
        })
      })

      await act(async () => {
        fireEvent.click(screen.getByText('⏹ 停止'))
      })

      expect(engine.stop).toHaveBeenCalledOnce()
    })

    it('paused 状态下应该显示恢复和停止按钮', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        engine._emit('stats', {
          stats: createMockStats({ status: 'paused', uptimeMs: 1000 })
        })
      })

      expect(screen.getByText('▶ 恢复')).toBeDefined()
      expect(screen.getByText('⏹ 停止')).toBeDefined()
    })

    it('paused 状态下点击恢复应该调用 engine.resume', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        engine._emit('stats', {
          stats: createMockStats({ status: 'paused', uptimeMs: 1000 })
        })
      })

      await act(async () => {
        fireEvent.click(screen.getByText('▶ 恢复'))
      })

      expect(engine.resume).toHaveBeenCalledOnce()
    })

    it('paused 状态下点击停止应该调用 engine.stop', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        engine._emit('stats', {
          stats: createMockStats({ status: 'paused', uptimeMs: 1000 })
        })
      })

      await act(async () => {
        fireEvent.click(screen.getByText('⏹ 停止'))
      })

      expect(engine.stop).toHaveBeenCalledOnce()
    })

    it('无 engine 时启动应通过 onCreateEngine 创建引擎', async () => {
      const newEngine = createMockEngine()
      const onCreateEngine = vi.fn().mockReturnValue(newEngine)

      render(
        <WatchPanel
          watchEngine={null}
          watchConfig={config}
          onCreateEngine={onCreateEngine}
        />
      )

      await act(async () => {
        fireEvent.click(screen.getByText('▶ 启动'))
      })

      expect(onCreateEngine).toHaveBeenCalledWith(config)
      expect(newEngine.start).toHaveBeenCalledOnce()
    })

    it('无 config 且无 engine 时启动按钮应该禁用', () => {
      const { container } = render(
        <WatchPanel watchEngine={null} watchConfig={null} />
      )

      const startBtn = container.querySelector('.bee-watch-btn-start') as HTMLButtonElement
      expect(startBtn.disabled).toBe(true)
    })
  })

  // ══════════════════════════════════════
  // 状态显示
  // ══════════════════════════════════════
  describe('状态显示', () => {
    it('watching 状态应该显示监听中', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        engine._emit('stats', {
          stats: createMockStats({ status: 'watching' })
        })
      })

      expect(screen.getByText('监听中')).toBeDefined()
    })

    it('paused 状态应该显示已暂停', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        engine._emit('stats', {
          stats: createMockStats({ status: 'paused' })
        })
      })

      expect(screen.getByText('已暂停')).toBeDefined()
    })

    it('error 状态应该显示错误', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        engine._emit('stats', {
          stats: createMockStats({ status: 'error' })
        })
      })

      expect(screen.getByText('错误')).toBeDefined()
    })

    it('watching 状态应该有 active 状态点样式', async () => {
      const { container } = render(
        <WatchPanel watchEngine={engine} watchConfig={config} />
      )

      await act(async () => {
        engine._emit('stats', {
          stats: createMockStats({ status: 'watching' })
        })
      })

      expect(container.querySelector('.bee-watch-status-active')).not.toBeNull()
    })

    it('paused 状态应该有 paused 状态点样式', async () => {
      const { container } = render(
        <WatchPanel watchEngine={engine} watchConfig={config} />
      )

      await act(async () => {
        engine._emit('stats', {
          stats: createMockStats({ status: 'paused' })
        })
      })

      expect(container.querySelector('.bee-watch-status-paused')).not.toBeNull()
    })

    it('error 状态应该有 error 状态点样式', async () => {
      const { container } = render(
        <WatchPanel watchEngine={engine} watchConfig={config} />
      )

      await act(async () => {
        engine._emit('stats', {
          stats: createMockStats({ status: 'error' })
        })
      })

      expect(container.querySelector('.bee-watch-status-error')).not.toBeNull()
    })
  })

  // ══════════════════════════════════════
  // 引擎事件监听
  // ══════════════════════════════════════
  describe('引擎事件监听', () => {
    it('应该注册 stats、trigger、action、error 事件监听器', () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      expect(engine.addEventListener).toHaveBeenCalledWith('stats', expect.any(Function))
      expect(engine.addEventListener).toHaveBeenCalledWith('trigger', expect.any(Function))
      expect(engine.addEventListener).toHaveBeenCalledWith('action', expect.any(Function))
      expect(engine.addEventListener).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('卸载组件时应该移除事件监听器', () => {
      const { unmount } = render(
        <WatchPanel watchEngine={engine} watchConfig={config} />
      )

      unmount()

      expect(engine.removeEventListener).toHaveBeenCalledWith('stats', expect.any(Function))
      expect(engine.removeEventListener).toHaveBeenCalledWith('trigger', expect.any(Function))
      expect(engine.removeEventListener).toHaveBeenCalledWith('action', expect.any(Function))
      expect(engine.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('stats 事件应该更新统计数据和状态', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        engine._emit('stats', {
          stats: createMockStats({ status: 'watching', llmCallCount: 99 })
        })
      })

      expect(screen.getByText('监听中')).toBeDefined()
    })

    it('trigger 事件应该刷新规则和日志', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      await act(async () => {
        engine._emit('trigger', {})
      })

      // trigger 事件触发后应调用 getRules 和 getLogs
      expect(engine.getRules).toHaveBeenCalled()
      expect(engine.getLogs).toHaveBeenCalled()
    })

    it('action 事件应该刷新日志', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      // 清除初始化时的调用记录
      engine.getLogs.mockClear()

      await act(async () => {
        engine._emit('action', {})
      })

      expect(engine.getLogs).toHaveBeenCalled()
    })

    it('error 事件应该刷新日志', async () => {
      render(<WatchPanel watchEngine={engine} watchConfig={config} />)

      engine.getLogs.mockClear()

      await act(async () => {
        engine._emit('error', {})
      })

      expect(engine.getLogs).toHaveBeenCalled()
    })

    it('watchEngine prop 变化时应该更新内部 engine', async () => {
      const { rerender } = render(
        <WatchPanel watchEngine={null} watchConfig={config} />
      )

      // 重新渲染传入新 engine
      rerender(
        <WatchPanel watchEngine={engine} watchConfig={config} />
      )

      // 新 engine 应该被注册事件监听
      expect(engine.addEventListener).toHaveBeenCalledWith('stats', expect.any(Function))
    })
  })

  // ══════════════════════════════════════
  // 格式化辅助函数（通过 UI 间接测试）
  // ══════════════════════════════════════
  describe('格式化函数', () => {
    it('formatDuration 应该正确格式化秒', () => {
      const stats = createMockStats({ uptimeMs: 45000 }) // 45 seconds
      engine = createMockEngine({ stats })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)
      expect(screen.getByText(/运行 45s/)).toBeDefined()
    })

    it('formatDuration 应该正确格式化分钟', () => {
      const stats = createMockStats({ uptimeMs: 125000 }) // 2m 5s
      engine = createMockEngine({ stats })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)
      expect(screen.getByText(/运行 2m 5s/)).toBeDefined()
    })

    it('formatDuration 应该正确格式化小时', () => {
      const stats = createMockStats({ uptimeMs: 5400000 }) // 1h 30m
      engine = createMockEngine({ stats })

      render(<WatchPanel watchEngine={engine} watchConfig={config} />)
      expect(screen.getByText(/运行 1h 30m/)).toBeDefined()
    })
  })
})

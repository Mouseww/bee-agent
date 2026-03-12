/**
 * Background Service Worker 单元测试
 * @description 测试 Chrome 扩展后台服务：安装事件、图标点击、消息监听
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Chrome API Mock ──────────────────────────────────────────────────
type Listener = (...args: any[]) => any

function createEventMock() {
  const listeners: Listener[] = []
  return {
    addListener: vi.fn((fn: Listener) => { listeners.push(fn) }),
    _listeners: listeners,
    _fire(...args: any[]) {
      return listeners.map(fn => fn(...args))
    }
  }
}

function setupChromeMock() {
  const onInstalled = createEventMock()
  const onClicked = createEventMock()
  const onMessage = createEventMock()

  const chromeMock = {
    runtime: {
      onInstalled,
      onMessage
    },
    action: {
      onClicked
    },
    tabs: {
      sendMessage: vi.fn().mockResolvedValue(undefined)
    }
  }

  vi.stubGlobal('chrome', chromeMock)
  return chromeMock
}

describe('Background Service Worker', () => {
  let chromeMock: ReturnType<typeof setupChromeMock>

  beforeEach(() => {
    chromeMock = setupChromeMock()
    vi.clearAllMocks()
    // 注册 listener
    chromeMock = setupChromeMock()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * 加载 background.ts 模块，触发其顶层代码（注册监听器）
   * 每次使用动态 import + 时间戳来避免缓存
   */
  async function loadBackground() {
    // 使用 vi.importActual 不行，用 resetModules + import
    vi.resetModules()
    await import('../background')
  }

  describe('扩展安装事件', () => {
    it('应该注册 onInstalled 监听器', async () => {
      await loadBackground()

      expect(chromeMock.runtime.onInstalled.addListener).toHaveBeenCalledOnce()
      expect(chromeMock.runtime.onInstalled._listeners).toHaveLength(1)
    })

    it('onInstalled 回调应该打印安装日志', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await loadBackground()
      chromeMock.runtime.onInstalled._fire()

      expect(consoleSpy).toHaveBeenCalledWith('BeeAgent Extension 已安装')
      consoleSpy.mockRestore()
    })
  })

  describe('扩展图标点击事件', () => {
    it('应该注册 action.onClicked 监听器', async () => {
      await loadBackground()

      expect(chromeMock.action.onClicked.addListener).toHaveBeenCalledOnce()
      expect(chromeMock.action.onClicked._listeners).toHaveLength(1)
    })

    it('点击图标时应该发送 activate 消息到 content script', async () => {
      await loadBackground()

      const tab = { id: 42 }
      await chromeMock.action.onClicked._fire(tab)[0]

      expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(42, { action: 'activate' })
    })

    it('tab.id 为 null 时不应该发送消息', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await loadBackground()

      const tab = { id: null }
      await chromeMock.action.onClicked._fire(tab)[0]

      expect(chromeMock.tabs.sendMessage).not.toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith('激活失败: 无法获取标签页 ID')
      consoleSpy.mockRestore()
    })

    it('tab.id 为 undefined 时不应该发送消息', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await loadBackground()

      const tab = { id: undefined }
      await chromeMock.action.onClicked._fire(tab)[0]

      expect(chromeMock.tabs.sendMessage).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('sendMessage 失败时应该打印错误日志', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('Connection failed')
      chromeMock.tabs.sendMessage.mockRejectedValueOnce(error)

      await loadBackground()

      const tab = { id: 42 }
      await chromeMock.action.onClicked._fire(tab)[0]

      expect(consoleSpy).toHaveBeenCalledWith('激活失败:', error)
      consoleSpy.mockRestore()
    })
  })

  describe('消息监听', () => {
    it('应该注册 runtime.onMessage 监听器', async () => {
      await loadBackground()

      expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledOnce()
      expect(chromeMock.runtime.onMessage._listeners).toHaveLength(1)
    })

    it('收到 log 消息时应该打印日志', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await loadBackground()

      const message = { action: 'log', data: 'Test log message' }
      chromeMock.runtime.onMessage._fire(message, {}, vi.fn())

      expect(consoleSpy).toHaveBeenCalledWith('[BeeAgent]', 'Test log message')
      consoleSpy.mockRestore()
    })

    it('收到非 log 消息时不应该打印日志', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await loadBackground()

      const message = { action: 'other', data: 'Something' }
      chromeMock.runtime.onMessage._fire(message, {}, vi.fn())

      // 可能有 loadBackground 时的 onInstalled log，只检查不包含 [BeeAgent]
      const beeAgentCalls = consoleSpy.mock.calls.filter(call => call[0] === '[BeeAgent]')
      expect(beeAgentCalls).toHaveLength(0)
      consoleSpy.mockRestore()
    })

    it('消息监听器应该返回 true（保持消息通道）', async () => {
      await loadBackground()

      const message = { action: 'log', data: 'data' }
      const results = chromeMock.runtime.onMessage._fire(message, {}, vi.fn())

      expect(results[0]).toBe(true)
    })
  })
})

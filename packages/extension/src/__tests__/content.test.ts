/**
 * Content Script 单元测试
 * @description 测试页面注入逻辑：消息激活、快捷键、URL 匹配、自动注入、资源清理
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

// Mock dependencies - 必须在 import 之前声明
const mockDispose = vi.fn()
const mockMountBeeAgentUI = vi.fn().mockReturnValue(vi.fn())

// 使用工厂函数确保每次构造都返回带 dispose 的实例
// vi.clearAllMocks() 会清除 mockImplementation，所以用 factory 包裹
function createMockAgent() {
  return {
    dispose: mockDispose,
    execute: vi.fn().mockResolvedValue({ success: true }),
    stop: vi.fn(),
    getStatus: vi.fn().mockReturnValue('idle'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}

vi.mock('@bee-agent/agent-core', () => {
  const BeeAgent = vi.fn().mockImplementation(() => createMockAgent())
  return { BeeAgent }
})

vi.mock('@bee-agent/ui', () => ({
  mountBeeAgentUI: (...args: any[]) => mockMountBeeAgentUI(...args)
}))

function setupChromeMock(storageData: Record<string, any> = {}) {
  const onMessage = createEventMock()

  const chromeMock = {
    runtime: {
      onMessage
    },
    storage: {
      sync: {
        get: vi.fn().mockImplementation((keys: string[] | string, callback?: Function) => {
          if (callback) {
            callback(storageData)
            return
          }
          return Promise.resolve(storageData)
        })
      }
    }
  }

  vi.stubGlobal('chrome', chromeMock)
  return chromeMock
}

describe('Content Script', () => {
  let chromeMock: ReturnType<typeof setupChromeMock>

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockMountBeeAgentUI.mockReturnValue(vi.fn())
    // 重新设置 BeeAgent mock（vi.clearAllMocks 会清除 mockImplementation）
    const { BeeAgent } = await import('@bee-agent/agent-core')
    ;(BeeAgent as any).mockImplementation(() => createMockAgent())
    // happy-dom 不提供 window.alert，全局 stub 防止 unhandled error
    vi.stubGlobal('alert', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function loadContent(storageData: Record<string, any> = {}) {
    chromeMock = setupChromeMock(storageData)
    vi.resetModules()
    await import('../content')
  }

  describe('消息监听', () => {
    it('应该注册 runtime.onMessage 监听器', async () => {
      await loadContent()

      expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledOnce()
    })

    it('收到 activate 消息时应该激活 BeeAgent', async () => {
      await loadContent({ apiKey: 'test-key', model: 'gpt-4' })

      const sendResponse = vi.fn()
      chromeMock.runtime.onMessage._fire({ action: 'activate' }, {}, sendResponse)

      // 等待 activateBeeAgent 的异步操作
      await vi.advanceTimersByTimeAsync(0)

      expect(sendResponse).toHaveBeenCalledWith({ success: true })
    })

    it('消息监听器应该返回 true（保持消息通道）', async () => {
      await loadContent()

      const results = chromeMock.runtime.onMessage._fire({ action: 'activate' }, {}, vi.fn())
      expect(results[0]).toBe(true)
    })
  })

  describe('快捷键监听', () => {
    it('按下 Ctrl+Shift+B 应该激活 BeeAgent', async () => {
      await loadContent({ apiKey: 'test-key', model: 'gpt-4' })

      const event = new KeyboardEvent('keydown', {
        ctrlKey: true,
        shiftKey: true,
        key: 'B',
        cancelable: true
      })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      document.dispatchEvent(event)
      await vi.advanceTimersByTimeAsync(0)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('非 Ctrl+Shift+B 组合键不应该触发', async () => {
      await loadContent({ apiKey: 'test-key' })

      // 只 Ctrl+B（没有 Shift）
      const event = new KeyboardEvent('keydown', {
        ctrlKey: true,
        shiftKey: false,
        key: 'B'
      })

      document.dispatchEvent(event)
      await vi.advanceTimersByTimeAsync(0)

      // storage.sync.get 只在模块加载时调用（自动注入检查），不会因快捷键再次调用
      // 这里检查 BeeAgent 构造函数不会被调用
      const { BeeAgent } = await import('@bee-agent/agent-core')
      const callsDuringShortcut = (BeeAgent as any).mock?.calls?.length ?? 0
      // 快捷键不触发时不会有额外调用
      expect(callsDuringShortcut).toBe(0)
    })
  })

  describe('activateBeeAgent', () => {
    it('没有 apiKey 时应该弹出提示', async () => {
      await loadContent({})

      // 通过消息触发 activate
      chromeMock.runtime.onMessage._fire({ action: 'activate' }, {}, vi.fn())
      await vi.advanceTimersByTimeAsync(0)

      expect(alert).toHaveBeenCalledWith('请先在扩展设置中配置 API Key')
    })

    it('有 apiKey 时应该创建 BeeAgent 并挂载 UI', async () => {
      await loadContent({
        apiKey: 'sk-test',
        baseURL: 'https://api.test.com/v1',
        model: 'gpt-4'
      })

      chromeMock.runtime.onMessage._fire({ action: 'activate' }, {}, vi.fn())
      await vi.advanceTimersByTimeAsync(0)

      const { BeeAgent } = await import('@bee-agent/agent-core')
      expect(BeeAgent).toHaveBeenCalledWith({
        apiKey: 'sk-test',
        model: 'gpt-4',
        baseURL: 'https://api.test.com/v1'
      })
      expect(mockMountBeeAgentUI).toHaveBeenCalled()
    })

    it('baseURL 没有以 /v1 结尾时应该自动补全', async () => {
      await loadContent({
        apiKey: 'sk-test',
        baseURL: 'https://api.test.com',
        model: 'gpt-4'
      })

      chromeMock.runtime.onMessage._fire({ action: 'activate' }, {}, vi.fn())
      await vi.advanceTimersByTimeAsync(0)

      const { BeeAgent } = await import('@bee-agent/agent-core')
      expect(BeeAgent).toHaveBeenCalledWith(
        expect.objectContaining({ baseURL: 'https://api.test.com/v1' })
      )
    })

    it('baseURL 末尾有多余斜杠时应该清理', async () => {
      await loadContent({
        apiKey: 'sk-test',
        baseURL: 'https://api.test.com/v1/',
        model: 'gpt-4'
      })

      chromeMock.runtime.onMessage._fire({ action: 'activate' }, {}, vi.fn())
      await vi.advanceTimersByTimeAsync(0)

      const { BeeAgent } = await import('@bee-agent/agent-core')
      expect(BeeAgent).toHaveBeenCalledWith(
        expect.objectContaining({ baseURL: 'https://api.test.com/v1' })
      )
    })

    it('没有 baseURL 时应该使用默认值', async () => {
      await loadContent({
        apiKey: 'sk-test',
        model: 'gpt-4'
      })

      chromeMock.runtime.onMessage._fire({ action: 'activate' }, {}, vi.fn())
      await vi.advanceTimersByTimeAsync(0)

      const { BeeAgent } = await import('@bee-agent/agent-core')
      expect(BeeAgent).toHaveBeenCalledWith(
        expect.objectContaining({ baseURL: 'https://api.openai.com/v1' })
      )
    })

    it('优先使用 customModel', async () => {
      await loadContent({
        apiKey: 'sk-test',
        model: 'gpt-4',
        customModel: 'claude-3-opus'
      })

      chromeMock.runtime.onMessage._fire({ action: 'activate' }, {}, vi.fn())
      await vi.advanceTimersByTimeAsync(0)

      const { BeeAgent } = await import('@bee-agent/agent-core')
      expect(BeeAgent).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-3-opus' })
      )
    })

    it('没有 model 和 customModel 时应该默认 gpt-4', async () => {
      await loadContent({ apiKey: 'sk-test' })

      chromeMock.runtime.onMessage._fire({ action: 'activate' }, {}, vi.fn())
      await vi.advanceTimersByTimeAsync(0)

      const { BeeAgent } = await import('@bee-agent/agent-core')
      expect(BeeAgent).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4' })
      )
    })

    it('已激活时不应该重复创建', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      await loadContent({
        apiKey: 'sk-test',
        model: 'gpt-4'
      })

      // 第一次激活
      chromeMock.runtime.onMessage._fire({ action: 'activate' }, {}, vi.fn())
      await vi.advanceTimersByTimeAsync(0)

      const { BeeAgent } = await import('@bee-agent/agent-core')
      const callCountAfterFirst = (BeeAgent as any).mock.calls.length

      // 第二次激活
      chromeMock.runtime.onMessage._fire({ action: 'activate' }, {}, vi.fn())
      await vi.advanceTimersByTimeAsync(0)

      expect((BeeAgent as any).mock.calls.length).toBe(callCountAfterFirst)
      expect(consoleSpy).toHaveBeenCalledWith('BeeAgent 已经激活')
      consoleSpy.mockRestore()
    })

    it('创建 Agent 失败时应该弹出错误提示', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // 让 BeeAgent 构造函数抛异常
      const { BeeAgent } = await import('@bee-agent/agent-core')
      ;(BeeAgent as any).mockImplementationOnce(() => {
        throw new Error('Init failed')
      })

      await loadContent({
        apiKey: 'sk-test',
        model: 'gpt-4'
      })

      chromeMock.runtime.onMessage._fire({ action: 'activate' }, {}, vi.fn())
      await vi.advanceTimersByTimeAsync(0)

      expect(alert).toHaveBeenCalledWith('激活失败: Init failed')
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('urlMatchesPattern', () => {
    // urlMatchesPattern 是模块内部函数，通过自动注入逻辑间接测试
    // 我们用自动注入 + urlFilter 来验证 URL 匹配行为

    it('精确匹配 URL', async () => {
      // 设置 location
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com/page' },
        writable: true,
        configurable: true
      })

      await loadContent({
        autoInject: true,
        apiKey: 'sk-test',
        urlFilter: 'https://example.com/page'
      })

      // 自动注入使用 setTimeout 1500ms
      await vi.advanceTimersByTimeAsync(1500)

      const { BeeAgent } = await import('@bee-agent/agent-core')
      expect(BeeAgent).toHaveBeenCalled()
    })

    it('通配符 * 匹配', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com/some/path' },
        writable: true,
        configurable: true
      })

      await loadContent({
        autoInject: true,
        apiKey: 'sk-test',
        urlFilter: 'https://example.com/*'
      })

      await vi.advanceTimersByTimeAsync(1500)

      const { BeeAgent } = await import('@bee-agent/agent-core')
      expect(BeeAgent).toHaveBeenCalled()
    })

    it('不匹配的 URL 不应该自动注入', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://other-site.com/page' },
        writable: true,
        configurable: true
      })

      await loadContent({
        autoInject: true,
        apiKey: 'sk-test',
        urlFilter: 'https://example.com/*'
      })

      await vi.advanceTimersByTimeAsync(1500)

      const { BeeAgent } = await import('@bee-agent/agent-core')
      expect(BeeAgent).not.toHaveBeenCalled()
    })

    it('子域名通配符匹配', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://sub.example.com/page' },
        writable: true,
        configurable: true
      })

      await loadContent({
        autoInject: true,
        apiKey: 'sk-test',
        urlFilter: 'https://*.example.com/*'
      })

      await vi.advanceTimersByTimeAsync(1500)

      const { BeeAgent } = await import('@bee-agent/agent-core')
      expect(BeeAgent).toHaveBeenCalled()
    })
  })

  describe('自动注入', () => {
    it('autoInject 为 true 且无 urlFilter 时应该在所有页面注入', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://any-site.com' },
        writable: true,
        configurable: true
      })

      await loadContent({
        autoInject: true,
        apiKey: 'sk-test'
      })

      await vi.advanceTimersByTimeAsync(1500)

      const { BeeAgent } = await import('@bee-agent/agent-core')
      expect(BeeAgent).toHaveBeenCalled()
    })

    it('autoInject 为 false 时不应该自动注入', async () => {
      await loadContent({
        autoInject: false,
        apiKey: 'sk-test'
      })

      await vi.advanceTimersByTimeAsync(1500)

      const { BeeAgent } = await import('@bee-agent/agent-core')
      expect(BeeAgent).not.toHaveBeenCalled()
    })

    it('没有 apiKey 时不应该自动注入', async () => {
      await loadContent({ autoInject: true })

      await vi.advanceTimersByTimeAsync(1500)

      const { BeeAgent } = await import('@bee-agent/agent-core')
      expect(BeeAgent).not.toHaveBeenCalled()
    })

    it('多行 URL 过滤规则应该逐行匹配', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://site-b.com/path' },
        writable: true,
        configurable: true
      })

      await loadContent({
        autoInject: true,
        apiKey: 'sk-test',
        urlFilter: 'https://site-a.com/*\nhttps://site-b.com/*'
      })

      await vi.advanceTimersByTimeAsync(1500)

      const { BeeAgent } = await import('@bee-agent/agent-core')
      expect(BeeAgent).toHaveBeenCalled()
    })

    it('自动注入应该延迟 1500ms', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com' },
        writable: true,
        configurable: true
      })

      await loadContent({
        autoInject: true,
        apiKey: 'sk-test'
      })

      // 1000ms 时还未注入
      await vi.advanceTimersByTimeAsync(1000)
      const { BeeAgent } = await import('@bee-agent/agent-core')
      const callsBefore = (BeeAgent as any).mock.calls.length

      // 再过 500ms 应该注入了
      await vi.advanceTimersByTimeAsync(500)
      expect((BeeAgent as any).mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  describe('页面卸载清理', () => {
    it('应该注册 beforeunload 事件监听器', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

      await loadContent()

      const beforeUnloadCalls = addEventListenerSpy.mock.calls.filter(
        call => call[0] === 'beforeunload'
      )
      expect(beforeUnloadCalls.length).toBeGreaterThan(0)
      addEventListenerSpy.mockRestore()
    })
  })
})

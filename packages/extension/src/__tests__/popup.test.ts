/**
 * Popup 脚本单元测试
 * @description 测试配置界面：设置加载/保存、模型获取、激活按钮、状态提示
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

function setupChromeMock(storageData: Record<string, any> = {}) {
  const chromeMock = {
    storage: {
      sync: {
        get: vi.fn().mockImplementation((keys: string[], callback?: Function) => {
          if (callback) {
            callback(storageData)
            return
          }
          return Promise.resolve(storageData)
        }),
        set: vi.fn().mockImplementation((data: any, callback?: Function) => {
          if (callback) callback()
        })
      }
    },
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 1 }]),
      sendMessage: vi.fn().mockImplementation((_tabId: number, _msg: any, callback?: Function) => {
        if (callback) callback()
      })
    },
    runtime: {
      lastError: null as any
    }
  }

  vi.stubGlobal('chrome', chromeMock)
  return chromeMock
}

/**
 * 创建 Popup 需要的 DOM 元素
 */
function setupPopupDOM() {
  document.body.innerHTML = `
    <input id="apiKey" type="text" />
    <input id="baseURL" type="text" />
    <select id="model"></select>
    <input id="customModel" type="text" />
    <select id="language"><option value="zh-CN">中文</option><option value="en">English</option></select>
    <input id="autoInject" type="checkbox" />
    <div id="urlFilterGroup" style="display: none">
      <textarea id="urlFilter"></textarea>
    </div>
    <button id="fetchModelsBtn">获取模型</button>
    <button id="saveBtn">保存</button>
    <button id="activateBtn">激活</button>
    <div id="status" style="display: none"></div>
  `
}

describe('Popup Script', () => {
  let chromeMock: ReturnType<typeof setupChromeMock>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    setupPopupDOM()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  async function loadPopup(storageData: Record<string, any> = {}) {
    chromeMock = setupChromeMock(storageData)
    vi.resetModules()
    await import('../popup')
  }

  describe('设置加载', () => {
    it('应该从 chrome.storage 加载已保存的设置', async () => {
      await loadPopup({
        apiKey: 'sk-saved',
        baseURL: 'https://saved.api.com',
        language: 'en',
        customModel: 'custom-model'
      })

      expect((document.getElementById('apiKey') as HTMLInputElement).value).toBe('sk-saved')
      expect((document.getElementById('baseURL') as HTMLInputElement).value).toBe('https://saved.api.com')
      expect((document.getElementById('language') as HTMLSelectElement).value).toBe('en')
      expect((document.getElementById('customModel') as HTMLInputElement).value).toBe('custom-model')
    })

    it('加载时 autoInject 为 true 时应该显示 urlFilter', async () => {
      await loadPopup({
        autoInject: true,
        urlFilter: 'https://example.com/*'
      })

      const autoInjectEl = document.getElementById('autoInject') as HTMLInputElement
      const urlFilterGroup = document.getElementById('urlFilterGroup') as HTMLDivElement
      const urlFilterEl = document.getElementById('urlFilter') as HTMLTextAreaElement

      expect(autoInjectEl.checked).toBe(true)
      expect(urlFilterGroup.style.display).toBe('block')
      expect(urlFilterEl.value).toBe('https://example.com/*')
    })

    it('有 apiKey 和 baseURL 时应该自动获取模型列表', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 'gpt-4', owned_by: 'openai' },
            { id: 'gpt-3.5-turbo', owned_by: 'openai' }
          ]
        })
      } as Response)

      await loadPopup({
        apiKey: 'sk-test',
        baseURL: 'https://api.test.com/v1'
      })

      // fetch 是异步的，需要等待
      await vi.advanceTimersByTimeAsync(0)

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.test.com/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-test'
          })
        })
      )

      fetchSpy.mockRestore()
    })
  })

  describe('获取模型按钮', () => {
    it('没有 apiKey 时应该显示错误提示', async () => {
      await loadPopup()

      const fetchBtn = document.getElementById('fetchModelsBtn') as HTMLButtonElement
      fetchBtn.click()

      const status = document.getElementById('status') as HTMLDivElement
      expect(status.textContent).toBe('请先输入 API Key')
      expect(status.className).toContain('error')
    })

    it('有 apiKey 时应该发起 fetch 请求', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'gpt-4' }] })
      } as Response)

      await loadPopup()

      // 设置 apiKey
      const apiKeyEl = document.getElementById('apiKey') as HTMLInputElement
      apiKeyEl.value = 'sk-my-key'

      const fetchBtn = document.getElementById('fetchModelsBtn') as HTMLButtonElement
      fetchBtn.click()

      await vi.advanceTimersByTimeAsync(0)

      expect(fetchSpy).toHaveBeenCalled()
      fetchSpy.mockRestore()
    })

    it('获取模型成功时应该填充下拉列表', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 'gpt-4', owned_by: 'openai' },
            { id: 'claude-3', owned_by: 'anthropic' }
          ]
        })
      } as Response)

      await loadPopup()

      const apiKeyEl = document.getElementById('apiKey') as HTMLInputElement
      apiKeyEl.value = 'sk-key'

      const fetchBtn = document.getElementById('fetchModelsBtn') as HTMLButtonElement
      fetchBtn.click()
      await vi.advanceTimersByTimeAsync(0)

      const modelEl = document.getElementById('model') as HTMLSelectElement
      const options = Array.from(modelEl.options)

      // 模型按字母排序
      expect(options.length).toBe(2)
      expect(options[0].value).toBe('claude-3')
      expect(options[1].value).toBe('gpt-4')
    })

    it('获取模型失败时应该显示错误提示', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({})
      } as Response)

      await loadPopup()

      const apiKeyEl = document.getElementById('apiKey') as HTMLInputElement
      apiKeyEl.value = 'sk-invalid'

      const fetchBtn = document.getElementById('fetchModelsBtn') as HTMLButtonElement
      fetchBtn.click()
      await vi.advanceTimersByTimeAsync(0)

      const status = document.getElementById('status') as HTMLDivElement
      expect(status.textContent).toContain('获取模型失败')
    })

    it('模型列表为空时应该显示提示', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] })
      } as Response)

      await loadPopup()

      const apiKeyEl = document.getElementById('apiKey') as HTMLInputElement
      apiKeyEl.value = 'sk-key'

      const fetchBtn = document.getElementById('fetchModelsBtn') as HTMLButtonElement
      fetchBtn.click()
      await vi.advanceTimersByTimeAsync(0)

      const modelEl = document.getElementById('model') as HTMLSelectElement
      expect(modelEl.innerHTML).toContain('无可用模型')
    })

    it('获取模型时应该禁用按钮并恢复', async () => {
      let resolvePromise: Function
      const fetchPromise = new Promise<Response>(resolve => { resolvePromise = resolve })
      vi.spyOn(globalThis, 'fetch').mockReturnValue(fetchPromise)

      await loadPopup()

      const apiKeyEl = document.getElementById('apiKey') as HTMLInputElement
      apiKeyEl.value = 'sk-key'

      const fetchBtn = document.getElementById('fetchModelsBtn') as HTMLButtonElement
      fetchBtn.click()

      // 按钮应该被禁用
      expect(fetchBtn.disabled).toBe(true)
      expect(fetchBtn.textContent).toBe('获取中...')

      // 完成请求
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'gpt-4' }] })
      } as Response)
      await vi.advanceTimersByTimeAsync(0)

      // 按钮应该恢复
      expect(fetchBtn.disabled).toBe(false)
      expect(fetchBtn.textContent).toBe('获取模型')
    })

    it('baseURL 应该自动规范化', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] })
      } as Response)

      await loadPopup()

      const apiKeyEl = document.getElementById('apiKey') as HTMLInputElement
      const baseURLEl = document.getElementById('baseURL') as HTMLInputElement
      apiKeyEl.value = 'sk-key'
      baseURLEl.value = 'https://api.test.com/'

      const fetchBtn = document.getElementById('fetchModelsBtn') as HTMLButtonElement
      fetchBtn.click()
      await vi.advanceTimersByTimeAsync(0)

      // URL 应该被规范化为 /v1/models
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.test.com/v1/models',
        expect.anything()
      )

      fetchSpy.mockRestore()
    })

    it('应该选中之前保存的模型', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 'gpt-3.5-turbo' },
            { id: 'gpt-4' }
          ]
        })
      } as Response)

      await loadPopup({
        apiKey: 'sk-test',
        baseURL: 'https://api.test.com/v1',
        model: 'gpt-4'
      })

      await vi.advanceTimersByTimeAsync(0)

      const modelEl = document.getElementById('model') as HTMLSelectElement
      expect(modelEl.value).toBe('gpt-4')
    })

    it('保存的模型不在列表中时应该添加', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'gpt-3.5-turbo' }]
        })
      } as Response)

      await loadPopup({
        apiKey: 'sk-test',
        baseURL: 'https://api.test.com/v1',
        model: 'custom-saved-model'
      })

      await vi.advanceTimersByTimeAsync(0)

      const modelEl = document.getElementById('model') as HTMLSelectElement
      expect(modelEl.value).toBe('custom-saved-model')
      const options = Array.from(modelEl.options)
      expect(options.some(opt => opt.textContent?.includes('已保存'))).toBe(true)
    })
  })

  describe('自动注入开关', () => {
    it('切换 autoInject 应该显示/隐藏 URL 过滤区域', async () => {
      await loadPopup()

      const autoInjectEl = document.getElementById('autoInject') as HTMLInputElement
      const urlFilterGroup = document.getElementById('urlFilterGroup') as HTMLDivElement

      // 初始状态隐藏
      expect(urlFilterGroup.style.display).toBe('none')

      // 打开开关
      autoInjectEl.checked = true
      autoInjectEl.dispatchEvent(new Event('change', { bubbles: true }))

      expect(urlFilterGroup.style.display).toBe('block')

      // 关闭开关
      autoInjectEl.checked = false
      autoInjectEl.dispatchEvent(new Event('change', { bubbles: true }))

      expect(urlFilterGroup.style.display).toBe('none')
    })
  })

  describe('保存设置', () => {
    it('点击保存应该将设置写入 chrome.storage', async () => {
      await loadPopup()

      // 填写表单
      ;(document.getElementById('apiKey') as HTMLInputElement).value = 'sk-new'
      ;(document.getElementById('baseURL') as HTMLInputElement).value = 'https://api.new.com'
      ;(document.getElementById('customModel') as HTMLInputElement).value = 'my-model'
      ;(document.getElementById('language') as HTMLSelectElement).value = 'zh-CN'

      const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement
      saveBtn.click()

      expect(chromeMock.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-new',
          baseURL: 'https://api.new.com',
          model: 'my-model',
          customModel: 'my-model',
          language: 'zh-CN'
        }),
        expect.any(Function)
      )
    })

    it('没有 apiKey 时不应该保存', async () => {
      await loadPopup()

      ;(document.getElementById('apiKey') as HTMLInputElement).value = ''
      ;(document.getElementById('customModel') as HTMLInputElement).value = 'model'

      const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement
      saveBtn.click()

      expect(chromeMock.storage.sync.set).not.toHaveBeenCalled()

      const status = document.getElementById('status') as HTMLDivElement
      expect(status.textContent).toBe('请输入 API Key')
    })

    it('没有 model 时不应该保存', async () => {
      await loadPopup()

      ;(document.getElementById('apiKey') as HTMLInputElement).value = 'sk-test'
      ;(document.getElementById('customModel') as HTMLInputElement).value = ''

      const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement
      saveBtn.click()

      expect(chromeMock.storage.sync.set).not.toHaveBeenCalled()

      const status = document.getElementById('status') as HTMLDivElement
      expect(status.textContent).toBe('请选择或输入模型名称')
    })

    it('保存成功后应该显示成功提示', async () => {
      await loadPopup()

      ;(document.getElementById('apiKey') as HTMLInputElement).value = 'sk-test'
      ;(document.getElementById('customModel') as HTMLInputElement).value = 'gpt-4'

      const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement
      saveBtn.click()

      const status = document.getElementById('status') as HTMLDivElement
      expect(status.textContent).toBe('设置已保存！')
      expect(status.className).toContain('success')
    })

    it('customModel 优先于下拉框选择', async () => {
      await loadPopup()

      ;(document.getElementById('apiKey') as HTMLInputElement).value = 'sk-test'

      // 下拉框有值
      const modelEl = document.getElementById('model') as HTMLSelectElement
      modelEl.innerHTML = '<option value="gpt-3.5-turbo">gpt-3.5-turbo</option>'
      modelEl.value = 'gpt-3.5-turbo'

      // 自定义模型也有值
      ;(document.getElementById('customModel') as HTMLInputElement).value = 'my-custom'

      const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement
      saveBtn.click()

      expect(chromeMock.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'my-custom' }),
        expect.any(Function)
      )
    })
  })

  describe('激活按钮', () => {
    it('点击激活应该查询当前标签并发送消息', async () => {
      await loadPopup()

      const activateBtn = document.getElementById('activateBtn') as HTMLButtonElement
      activateBtn.click()

      await vi.advanceTimersByTimeAsync(0)

      expect(chromeMock.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true })
      expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        { action: 'activate' },
        expect.any(Function)
      )
    })

    it('激活成功后应该显示成功提示', async () => {
      await loadPopup()

      const activateBtn = document.getElementById('activateBtn') as HTMLButtonElement
      activateBtn.click()

      await vi.advanceTimersByTimeAsync(0)

      const status = document.getElementById('status') as HTMLDivElement
      expect(status.textContent).toBe('BeeAgent 已激活！')
      expect(status.className).toContain('success')
    })

    it('激活失败时应该显示错误提示', async () => {
      await loadPopup()

      // 模拟 lastError
      chromeMock.tabs.sendMessage.mockImplementation((_tabId: number, _msg: any, callback?: Function) => {
        chromeMock.runtime.lastError = { message: 'Could not establish connection' }
        if (callback) callback()
        chromeMock.runtime.lastError = null
      })

      const activateBtn = document.getElementById('activateBtn') as HTMLButtonElement
      activateBtn.click()

      await vi.advanceTimersByTimeAsync(0)

      const status = document.getElementById('status') as HTMLDivElement
      expect(status.textContent).toBe('激活失败，请刷新页面后重试')
      expect(status.className).toContain('error')
    })
  })

  describe('showStatus', () => {
    it('状态提示应该在 3 秒后自动隐藏', async () => {
      await loadPopup()

      // 触发一个状态提示
      ;(document.getElementById('apiKey') as HTMLInputElement).value = 'sk-test'
      ;(document.getElementById('customModel') as HTMLInputElement).value = 'gpt-4'

      const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement
      saveBtn.click()

      const status = document.getElementById('status') as HTMLDivElement
      expect(status.style.display).toBe('block')

      // 3 秒后应该隐藏
      await vi.advanceTimersByTimeAsync(3000)
      expect(status.style.display).toBe('none')
    })
  })
})

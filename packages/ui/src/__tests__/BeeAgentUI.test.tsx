/**
 * BeeAgentUI 组件单元测试
 * @description 测试核心交互：消息发送、设置面板、主题切换
 *              组件采用悬浮图标 + 侧边栏设计
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react'
import { BeeAgentUI } from '../BeeAgentUI'

// Mock CSS import
vi.mock('../styles.css?inline', () => ({ default: '' }))

/** 创建 BeeAgent mock 实例（模拟 EventTarget 行为） */
function createMockAgent() {
  const listeners: Record<string, Function[]> = {}

  return {
    addEventListener: vi.fn((event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(handler)
    }),
    removeEventListener: vi.fn((event: string, handler: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== handler)
      }
    }),
    execute: vi.fn().mockResolvedValue({ success: true, message: 'Done' }),
    stop: vi.fn(),
    getStatus: vi.fn().mockReturnValue('idle'),
    getSteps: vi.fn().mockReturnValue([]),
    dispose: vi.fn(),
    // 测试辅助方法：触发事件
    _emit(event: string, detail: any) {
      const customEvent = new CustomEvent(event, { detail })
      listeners[event]?.forEach(h => h(customEvent))
    },
    _listeners: listeners
  } as any
}

/**
 * 辅助函数：渲染组件并打开侧边栏
 * 组件默认只显示悬浮图标，需要点击打开侧边栏才能看到内容
 */
async function renderAndOpenSidebar(agent: any, props: Record<string, any> = {}) {
  const result = render(<BeeAgentUI agent={agent} {...props} />)

  // 点击悬浮图标打开侧边栏
  const fab = result.container.querySelector('.bee-fab')
  if (fab) {
    await act(async () => {
      fireEvent.click(fab)
    })
  }

  return result
}

describe('BeeAgentUI', () => {
  let agent: ReturnType<typeof createMockAgent>

  beforeEach(() => {
    agent = createMockAgent()
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  describe('基础渲染', () => {
    it('应该渲染 BeeAgent 标题', async () => {
      await renderAndOpenSidebar(agent)

      expect(screen.getByText('BeeAgent')).toBeDefined()
    })

    it('应该显示状态点（初始为空闲）', async () => {
      const { container } = await renderAndOpenSidebar(agent)

      // 组件使用状态点(inline style)，title 表示状态
      const statusDot = container.querySelector('.bee-status-dot')
      expect(statusDot).not.toBeNull()
      expect(statusDot?.getAttribute('title')).toBe('就绪')
    })

    it('应该渲染输入框', async () => {
      await renderAndOpenSidebar(agent)

      const input = screen.getByPlaceholderText('输入任务...')
      expect(input).toBeDefined()
    })

    it('应该渲染发送按钮（初始禁用）', async () => {
      const { container } = await renderAndOpenSidebar(agent)

      // 发送按钮使用 → 符号，class 为 bee-send-btn
      const button = container.querySelector('.bee-send-btn') as HTMLButtonElement
      expect(button).not.toBeNull()
      expect(button.disabled).toBe(true)
    })

    it('应该渲染关闭按钮（侧边栏打开时始终存在）', async () => {
      await renderAndOpenSidebar(agent)

      const closeButton = screen.getByTitle('关闭')
      expect(closeButton).toBeDefined()
    })

    it('初始状态应显示悬浮图标而非侧边栏', () => {
      const { container } = render(<BeeAgentUI agent={agent} />)

      const fab = container.querySelector('.bee-fab')
      expect(fab).not.toBeNull()

      // 侧边栏存在但未打开（没有 bee-sidebar-open 类）
      const sidebar = container.querySelector('.bee-sidebar')
      expect(sidebar).not.toBeNull()
      expect(sidebar?.classList.contains('bee-sidebar-open')).toBe(false)
    })
  })

  describe('消息发送', () => {
    it('输入内容后发送按钮应该启用', async () => {
      const { container } = await renderAndOpenSidebar(agent)

      const input = screen.getByPlaceholderText('输入任务...')
      await act(async () => {
        fireEvent.change(input, { target: { value: '测试任务' } })
      })

      const button = container.querySelector('.bee-send-btn') as HTMLButtonElement
      expect(button.disabled).toBe(false)
    })

    it('提交表单应该调用 agent.execute 并显示消息', async () => {
      await renderAndOpenSidebar(agent)

      const input = screen.getByPlaceholderText('输入任务...')
      const form = input.closest('form')!

      await act(async () => {
        fireEvent.change(input, { target: { value: '打开百度' } })
      })

      await act(async () => {
        fireEvent.submit(form)
      })

      expect(agent.execute).toHaveBeenCalledWith('打开百度')
    })

    it('提交后输入框应该被清空', async () => {
      await renderAndOpenSidebar(agent)

      const input = screen.getByPlaceholderText('输入任务...') as HTMLInputElement

      await act(async () => {
        fireEvent.change(input, { target: { value: '测试' } })
      })

      const form = input.closest('form')!

      await act(async () => {
        fireEvent.submit(form)
      })

      expect(input.value).toBe('')
    })

    it('空输入不应触发 execute', async () => {
      await renderAndOpenSidebar(agent)

      const input = screen.getByPlaceholderText('输入任务...')
      const form = input.closest('form')!

      await act(async () => {
        fireEvent.submit(form)
      })

      expect(agent.execute).not.toHaveBeenCalled()
    })

    it('execute 成功时应该显示成功消息', async () => {
      agent.execute.mockResolvedValue({ success: true, message: '任务已完成' })
      await renderAndOpenSidebar(agent)

      const input = screen.getByPlaceholderText('输入任务...')
      const form = input.closest('form')!

      await act(async () => {
        fireEvent.change(input, { target: { value: '测试' } })
      })
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.getByText(/任务完成: 任务已完成/)).toBeDefined()
      })
    })

    it('execute 失败时应该显示失败消息', async () => {
      agent.execute.mockResolvedValue({ success: false, message: '找不到元素' })
      await renderAndOpenSidebar(agent)

      const input = screen.getByPlaceholderText('输入任务...')
      const form = input.closest('form')!

      await act(async () => {
        fireEvent.change(input, { target: { value: '测试' } })
      })
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.getByText(/任务失败: 找不到元素/)).toBeDefined()
      })
    })

    it('execute 抛出异常时应该显示错误消息', async () => {
      agent.execute.mockRejectedValue(new Error('网络错误'))
      await renderAndOpenSidebar(agent)

      const input = screen.getByPlaceholderText('输入任务...')
      const form = input.closest('form')!

      await act(async () => {
        fireEvent.change(input, { target: { value: '测试' } })
      })
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.getByText(/错误: 网络错误/)).toBeDefined()
      })
    })
  })

  describe('Agent 事件监听', () => {
    it('应该注册 statuschange、step、error 事件监听器', () => {
      render(<BeeAgentUI agent={agent} />)

      expect(agent.addEventListener).toHaveBeenCalledWith('statuschange', expect.any(Function))
      expect(agent.addEventListener).toHaveBeenCalledWith('step', expect.any(Function))
      expect(agent.addEventListener).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('statuschange 事件应该更新状态点样式', async () => {
      const { container } = await renderAndOpenSidebar(agent)

      await act(async () => {
        agent._emit('statuschange', { status: 'running' })
      })

      // running 状态 -> title 变为 "运行中"
      const statusDot = container.querySelector('.bee-status-dot')
      expect(statusDot).not.toBeNull()
      expect(statusDot?.getAttribute('title')).toBe('运行中')
    })

    it('error 事件应该显示错误消息', async () => {
      await renderAndOpenSidebar(agent)

      await act(async () => {
        agent._emit('error', { error: '连接超时' })
      })

      expect(screen.getByText(/错误: 连接超时/)).toBeDefined()
    })

    it('卸载组件时应该移除事件监听器', () => {
      const { unmount } = render(<BeeAgentUI agent={agent} />)

      unmount()

      expect(agent.removeEventListener).toHaveBeenCalledWith('statuschange', expect.any(Function))
      expect(agent.removeEventListener).toHaveBeenCalledWith('step', expect.any(Function))
      expect(agent.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function))
    })
  })

  describe('停止任务', () => {
    it('运行状态下应该显示停止按钮', async () => {
      const { container } = await renderAndOpenSidebar(agent)

      await act(async () => {
        agent._emit('statuschange', { status: 'running' })
      })

      // 停止按钮使用 ■ 符号，class 为 bee-stop-btn
      const stopButton = container.querySelector('.bee-stop-btn')
      expect(stopButton).not.toBeNull()
    })

    it('点击停止按钮应该调用 agent.stop', async () => {
      const { container } = await renderAndOpenSidebar(agent)

      await act(async () => {
        agent._emit('statuschange', { status: 'running' })
      })

      const stopButton = container.querySelector('.bee-stop-btn')!
      await act(async () => {
        fireEvent.click(stopButton)
      })

      expect(agent.stop).toHaveBeenCalledOnce()
    })
  })

  describe('设置面板', () => {
    it('点击设置按钮应该打开设置面板', async () => {
      await renderAndOpenSidebar(agent)

      const settingsButton = screen.getByTitle('设置')
      await act(async () => {
        fireEvent.click(settingsButton)
      })

      // 设置面板中应该有 "⚙️ 设置" 标题和 "Base URL" 标签
      expect(screen.getByText(/Base URL/)).toBeDefined()
      expect(screen.getByText(/API Key/)).toBeDefined()
    })

    it('设置面板应该包含所有设置项', async () => {
      await renderAndOpenSidebar(agent)

      const settingsButton = screen.getByTitle('设置')
      await act(async () => {
        fireEvent.click(settingsButton)
      })

      expect(screen.getByPlaceholderText('https://api.openai.com/v1')).toBeDefined()
      expect(screen.getByPlaceholderText('sk-...')).toBeDefined()
      expect(screen.getByPlaceholderText('例如 qwen-plus, deepseek-chat')).toBeDefined()
    })

    it('保存按钮应该将设置持久化到 localStorage', async () => {
      await renderAndOpenSidebar(agent)

      const settingsButton = screen.getByTitle('设置')
      await act(async () => {
        fireEvent.click(settingsButton)
      })

      const baseURLInput = screen.getByPlaceholderText('https://api.openai.com/v1')
      await act(async () => {
        fireEvent.change(baseURLInput, { target: { value: 'https://my-api.example.com/v1' } })
      })

      const saveButton = screen.getByText('保存')
      await act(async () => {
        fireEvent.click(saveButton)
      })

      const saved = JSON.parse(localStorage.getItem('bee-agent-settings')!)
      expect(saved.baseURL).toBe('https://my-api.example.com/v1')
    })

    it('保存后应该关闭设置面板', async () => {
      await renderAndOpenSidebar(agent)

      const settingsButton = screen.getByTitle('设置')
      await act(async () => {
        fireEvent.click(settingsButton)
      })

      const saveButton = screen.getByText('保存')
      await act(async () => {
        fireEvent.click(saveButton)
      })

      // 设置面板关闭后，输入框应该重新出现
      expect(screen.getByPlaceholderText('输入任务...')).toBeDefined()
    })

    it('取消按钮应该关闭设置面板而不保存', async () => {
      await renderAndOpenSidebar(agent)

      const settingsButton = screen.getByTitle('设置')
      await act(async () => {
        fireEvent.click(settingsButton)
      })

      const baseURLInput = screen.getByPlaceholderText('https://api.openai.com/v1')
      await act(async () => {
        fireEvent.change(baseURLInput, { target: { value: 'https://changed.com' } })
      })

      const cancelButton = screen.getByText('取消')
      await act(async () => {
        fireEvent.click(cancelButton)
      })

      // 面板关闭
      expect(screen.getByPlaceholderText('输入任务...')).toBeDefined()

      // localStorage 中不应有设置（未保存）
      expect(localStorage.getItem('bee-agent-settings')).toBeNull()
    })

    it('应该从 localStorage 加载已保存的设置', async () => {
      localStorage.setItem('bee-agent-settings', JSON.stringify({
        apiKey: 'sk-test-key',
        baseURL: 'https://saved-api.com/v1',
        model: '',
        customModel: 'gpt-4',
        language: 'en-US'
      }))

      await renderAndOpenSidebar(agent)

      const settingsButton = screen.getByTitle('设置')
      await act(async () => {
        fireEvent.click(settingsButton)
      })

      const baseURLInput = screen.getByPlaceholderText('https://api.openai.com/v1') as HTMLInputElement
      expect(baseURLInput.value).toBe('https://saved-api.com/v1')

      const customModelInput = screen.getByPlaceholderText('例如 qwen-plus, deepseek-chat') as HTMLInputElement
      expect(customModelInput.value).toBe('gpt-4')
    })
  })

  describe('主题切换', () => {
    it('默认应该是暗色主题', async () => {
      const { container } = await renderAndOpenSidebar(agent)

      // 组件使用 .bee-sidebar 带 data-theme 属性，默认暗色
      const themeRoot = container.querySelector('[data-theme]')
      expect(themeRoot?.getAttribute('data-theme')).toBe('dark')
    })

    it('点击主题按钮应该切换到浅色主题', async () => {
      const { container } = await renderAndOpenSidebar(agent)

      const themeButton = screen.getByTitle('主题')
      await act(async () => {
        fireEvent.click(themeButton)
      })

      const themeRoot = container.querySelector('[data-theme]')
      expect(themeRoot?.getAttribute('data-theme')).toBe('light')
    })

    it('主题应该持久化到 localStorage', async () => {
      await renderAndOpenSidebar(agent)

      const themeButton = screen.getByTitle('主题')
      await act(async () => {
        fireEvent.click(themeButton)
      })

      // 默认 dark，点一次变 light
      expect(localStorage.getItem('bee-agent-theme')).toBe('light')
    })

    it('再次点击应该切换回暗色主题', async () => {
      const { container } = await renderAndOpenSidebar(agent)

      const themeButton = screen.getByTitle('主题')

      // 切换到浅色
      await act(async () => {
        fireEvent.click(themeButton)
      })
      // 切换回暗色
      await act(async () => {
        fireEvent.click(themeButton)
      })

      const themeRoot = container.querySelector('[data-theme]')
      expect(themeRoot?.getAttribute('data-theme')).toBe('dark')
      expect(localStorage.getItem('bee-agent-theme')).toBe('dark')
    })

    it('应该从 localStorage 恢复浅色主题', async () => {
      localStorage.setItem('bee-agent-theme', 'light')

      const { container } = await renderAndOpenSidebar(agent)

      const themeRoot = container.querySelector('[data-theme]')
      expect(themeRoot?.getAttribute('data-theme')).toBe('light')
    })
  })

  describe('侧边栏开关', () => {
    it('点击悬浮图标应该打开侧边栏', async () => {
      const { container } = render(<BeeAgentUI agent={agent} />)

      const fab = container.querySelector('.bee-fab')!
      await act(async () => {
        fireEvent.click(fab)
      })

      const sidebar = container.querySelector('.bee-sidebar')
      expect(sidebar?.classList.contains('bee-sidebar-open')).toBe(true)
    })

    it('点击关闭按钮应该关闭侧边栏', async () => {
      const { container } = await renderAndOpenSidebar(agent)

      const closeButton = screen.getByTitle('关闭')
      await act(async () => {
        fireEvent.click(closeButton)
      })

      const sidebar = container.querySelector('.bee-sidebar')
      expect(sidebar?.classList.contains('bee-sidebar-open')).toBe(false)
    })
  })

  describe('关闭功能', () => {
    it('点击关闭按钮应该关闭侧边栏', async () => {
      const { container } = await renderAndOpenSidebar(agent, { onClose: vi.fn() })

      const closeButton = screen.getByTitle('关闭')
      await act(async () => {
        fireEvent.click(closeButton)
      })

      // 关闭按钮的行为是关闭侧边栏（setIsOpen(false)）
      const sidebar = container.querySelector('.bee-sidebar')
      expect(sidebar?.classList.contains('bee-sidebar-open')).toBe(false)
    })

    it('Ctrl+Shift+B 快捷键应该切换侧边栏', async () => {
      const { container } = await renderAndOpenSidebar(agent)

      // 侧边栏已打开，按快捷键应该关闭
      await act(async () => {
        fireEvent.keyDown(window, {
          key: 'B',
          ctrlKey: true,
          shiftKey: true
        })
      })

      const sidebar = container.querySelector('.bee-sidebar')
      expect(sidebar?.classList.contains('bee-sidebar-open')).toBe(false)
    })
  })

  describe('状态点显示', () => {
    it('应该正确显示各种状态对应的状态点', async () => {
      const { container } = await renderAndOpenSidebar(agent)

      const dot = container.querySelector('.bee-status-dot')!

      // idle -> title "就绪"
      expect(dot.getAttribute('title')).toBe('就绪')

      // running -> title "运行中"
      await act(async () => {
        agent._emit('statuschange', { status: 'running' })
      })
      expect(dot.getAttribute('title')).toBe('运行中')

      // error -> title "错误"
      await act(async () => {
        agent._emit('statuschange', { status: 'error' })
      })
      expect(dot.getAttribute('title')).toBe('错误')
    })
  })
})

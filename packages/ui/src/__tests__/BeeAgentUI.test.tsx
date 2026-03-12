/**
 * BeeAgentUI 组件单元测试
 * @description 测试核心交互：消息发送、设置面板、主题切换
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BeeAgentUI } from '../BeeAgentUI'

// Mock CSS import
vi.mock('../styles.css', () => ({}))

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
    it('应该渲染 BeeAgent 标题', () => {
      render(<BeeAgentUI agent={agent} />)

      expect(screen.getByText('BeeAgent')).toBeDefined()
    })

    it('应该显示初始状态为空闲', () => {
      render(<BeeAgentUI agent={agent} />)

      expect(screen.getByText(/空闲/)).toBeDefined()
    })

    it('应该渲染输入框', () => {
      render(<BeeAgentUI agent={agent} />)

      const input = screen.getByPlaceholderText('输入任务指令...')
      expect(input).toBeDefined()
    })

    it('应该渲染发送按钮（初始禁用）', () => {
      render(<BeeAgentUI agent={agent} />)

      const button = screen.getByText('发送')
      expect(button).toBeDefined()
      expect((button as HTMLButtonElement).disabled).toBe(true)
    })

    it('应该在传入 onClose 时渲染关闭按钮', () => {
      const onClose = vi.fn()
      render(<BeeAgentUI agent={agent} onClose={onClose} />)

      const closeButton = screen.getByTitle('关闭 (Ctrl+Shift+B)')
      expect(closeButton).toBeDefined()
    })

    it('不传入 onClose 时不应渲染关闭按钮', () => {
      render(<BeeAgentUI agent={agent} />)

      const closeButton = screen.queryByTitle('关闭 (Ctrl+Shift+B)')
      expect(closeButton).toBeNull()
    })
  })

  describe('消息发送', () => {
    it('输入内容后发送按钮应该启用', async () => {
      render(<BeeAgentUI agent={agent} />)

      const input = screen.getByPlaceholderText('输入任务指令...')
      await act(async () => {
        fireEvent.change(input, { target: { value: '测试任务' } })
      })

      const button = screen.getByText('发送')
      expect((button as HTMLButtonElement).disabled).toBe(false)
    })

    it('提交表单应该调用 agent.execute 并显示消息', async () => {
      render(<BeeAgentUI agent={agent} />)

      const input = screen.getByPlaceholderText('输入任务指令...')
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
      render(<BeeAgentUI agent={agent} />)

      const input = screen.getByPlaceholderText('输入任务指令...') as HTMLInputElement

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
      render(<BeeAgentUI agent={agent} />)

      const input = screen.getByPlaceholderText('输入任务指令...')
      const form = input.closest('form')!

      await act(async () => {
        fireEvent.submit(form)
      })

      expect(agent.execute).not.toHaveBeenCalled()
    })

    it('execute 成功时应该显示成功消息', async () => {
      agent.execute.mockResolvedValue({ success: true, message: '任务已完成' })
      render(<BeeAgentUI agent={agent} />)

      const input = screen.getByPlaceholderText('输入任务指令...')
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
      render(<BeeAgentUI agent={agent} />)

      const input = screen.getByPlaceholderText('输入任务指令...')
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
      render(<BeeAgentUI agent={agent} />)

      const input = screen.getByPlaceholderText('输入任务指令...')
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

    it('statuschange 事件应该更新状态显示', async () => {
      render(<BeeAgentUI agent={agent} />)

      await act(async () => {
        agent._emit('statuschange', { status: 'running' })
      })

      expect(screen.getByText(/运行中/)).toBeDefined()
    })

    it('error 事件应该显示错误消息', async () => {
      render(<BeeAgentUI agent={agent} />)

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
      render(<BeeAgentUI agent={agent} />)

      await act(async () => {
        agent._emit('statuschange', { status: 'running' })
      })

      expect(screen.getByText('停止')).toBeDefined()
    })

    it('点击停止按钮应该调用 agent.stop', async () => {
      render(<BeeAgentUI agent={agent} />)

      await act(async () => {
        agent._emit('statuschange', { status: 'running' })
      })

      const stopButton = screen.getByText('停止')
      await act(async () => {
        fireEvent.click(stopButton)
      })

      expect(agent.stop).toHaveBeenCalledOnce()
    })
  })

  describe('设置面板', () => {
    it('点击设置按钮应该打开设置面板', async () => {
      render(<BeeAgentUI agent={agent} />)

      const settingsButton = screen.getByTitle('设置')
      await act(async () => {
        fireEvent.click(settingsButton)
      })

      // 设置面板中应该有 "设置" 标题和 "Base URL" 标签
      expect(screen.getByText('设置')).toBeDefined()
      expect(screen.getByText(/Base URL/)).toBeDefined()
      expect(screen.getByText(/API Key/)).toBeDefined()
    })

    it('设置面板应该包含所有设置项', async () => {
      render(<BeeAgentUI agent={agent} />)

      const settingsButton = screen.getByTitle('设置')
      await act(async () => {
        fireEvent.click(settingsButton)
      })

      expect(screen.getByPlaceholderText('https://api.openai.com/v1')).toBeDefined()
      expect(screen.getByPlaceholderText('输入API Key')).toBeDefined()
      expect(screen.getByPlaceholderText('例如 qwen-plus, deepseek-chat')).toBeDefined()
    })

    it('保存按钮应该将设置持久化到 localStorage', async () => {
      render(<BeeAgentUI agent={agent} />)

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
      render(<BeeAgentUI agent={agent} />)

      const settingsButton = screen.getByTitle('设置')
      await act(async () => {
        fireEvent.click(settingsButton)
      })

      const saveButton = screen.getByText('保存')
      await act(async () => {
        fireEvent.click(saveButton)
      })

      // 设置面板关闭后，输入框应该重新出现
      expect(screen.getByPlaceholderText('输入任务指令...')).toBeDefined()
    })

    it('取消按钮应该关闭设置面板而不保存', async () => {
      render(<BeeAgentUI agent={agent} />)

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
      expect(screen.getByPlaceholderText('输入任务指令...')).toBeDefined()

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

      render(<BeeAgentUI agent={agent} />)

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
    it('默认应该是浅色主题', () => {
      const { container } = render(<BeeAgentUI agent={agent} />)

      const uiContainer = container.querySelector('.bee-agent-container')
      expect(uiContainer?.getAttribute('data-theme')).toBe('light')
    })

    it('点击主题按钮应该切换到暗色主题', async () => {
      const { container } = render(<BeeAgentUI agent={agent} />)

      const themeButton = screen.getByTitle('切换主题')
      await act(async () => {
        fireEvent.click(themeButton)
      })

      const uiContainer = container.querySelector('.bee-agent-container')
      expect(uiContainer?.getAttribute('data-theme')).toBe('dark')
    })

    it('切换主题应该持久化到 localStorage', async () => {
      render(<BeeAgentUI agent={agent} />)

      const themeButton = screen.getByTitle('切换主题')
      await act(async () => {
        fireEvent.click(themeButton)
      })

      expect(localStorage.getItem('bee-agent-theme')).toBe('dark')
    })

    it('再次点击应该切换回浅色主题', async () => {
      const { container } = render(<BeeAgentUI agent={agent} />)

      const themeButton = screen.getByTitle('切换主题')

      // 切换到暗色
      await act(async () => {
        fireEvent.click(themeButton)
      })
      // 切换回浅色
      await act(async () => {
        fireEvent.click(themeButton)
      })

      const uiContainer = container.querySelector('.bee-agent-container')
      expect(uiContainer?.getAttribute('data-theme')).toBe('light')
      expect(localStorage.getItem('bee-agent-theme')).toBe('light')
    })

    it('应该从 localStorage 恢复暗色主题', async () => {
      localStorage.setItem('bee-agent-theme', 'dark')

      const { container } = render(<BeeAgentUI agent={agent} />)

      const uiContainer = container.querySelector('.bee-agent-container')
      expect(uiContainer?.getAttribute('data-theme')).toBe('dark')
    })
  })

  describe('折叠/展开', () => {
    it('点击折叠按钮应该隐藏消息区域和输入区域', async () => {
      render(<BeeAgentUI agent={agent} />)

      const collapseButton = screen.getByTitle('折叠')
      await act(async () => {
        fireEvent.click(collapseButton)
      })

      // 折叠后输入框不应存在
      expect(screen.queryByPlaceholderText('输入任务指令...')).toBeNull()
    })

    it('再次点击应该展开', async () => {
      render(<BeeAgentUI agent={agent} />)

      // 折叠
      const collapseButton = screen.getByTitle('折叠')
      await act(async () => {
        fireEvent.click(collapseButton)
      })

      // 展开
      const expandButton = screen.getByTitle('展开')
      await act(async () => {
        fireEvent.click(expandButton)
      })

      expect(screen.getByPlaceholderText('输入任务指令...')).toBeDefined()
    })
  })

  describe('关闭功能', () => {
    it('点击关闭按钮应该调用 onClose', async () => {
      const onClose = vi.fn()
      render(<BeeAgentUI agent={agent} onClose={onClose} />)

      const closeButton = screen.getByTitle('关闭 (Ctrl+Shift+B)')
      await act(async () => {
        fireEvent.click(closeButton)
      })

      expect(onClose).toHaveBeenCalledOnce()
    })

    it('Ctrl+Shift+B 快捷键应该调用 onClose', async () => {
      const onClose = vi.fn()
      render(<BeeAgentUI agent={agent} onClose={onClose} />)

      await act(async () => {
        fireEvent.keyDown(window, {
          key: 'B',
          ctrlKey: true,
          shiftKey: true
        })
      })

      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  describe('状态文本显示', () => {
    it('应该正确显示各种状态文本', async () => {
      render(<BeeAgentUI agent={agent} />)

      // idle -> 空闲
      expect(screen.getByText(/空闲/)).toBeDefined()

      // running -> 运行中
      await act(async () => {
        agent._emit('statuschange', { status: 'running' })
      })
      expect(screen.getByText(/运行中/)).toBeDefined()

      // completed -> 已完成
      await act(async () => {
        agent._emit('statuschange', { status: 'completed' })
      })
      expect(screen.getByText(/已完成/)).toBeDefined()

      // error -> 错误
      await act(async () => {
        agent._emit('statuschange', { status: 'error' })
      })
      // "错误" 可能出现在多处（状态+消息），只需确认状态区显示
      const statusDiv = screen.getByText(/状态:/)
      expect(statusDiv.textContent).toContain('错误')
    })
  })
})

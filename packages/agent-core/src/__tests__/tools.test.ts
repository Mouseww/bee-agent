/**
 * Agent Tools 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTools } from '../tools'
import type { DOMEngine } from '@bee-agent/dom-engine'

describe('Agent Tools', () => {
  let mockDOMEngine: DOMEngine
  let tools: ReturnType<typeof createTools>

  beforeEach(() => {
    // 创建 mock DOMEngine
    mockDOMEngine = {
      click: vi.fn().mockResolvedValue('Clicked element 0'),
      type: vi.fn().mockResolvedValue('Typed text into element 0'),
      select: vi.fn().mockResolvedValue('Selected option in element 0'),
      scroll: vi.fn().mockResolvedValue('Scrolled down 1 pages'),
      hover: vi.fn().mockResolvedValue('Hovered over element 0'),
      keyboard: vi.fn().mockResolvedValue('Pressed key Enter on element 0'),
      wait: vi.fn().mockResolvedValue('Waited for 2 seconds'),
      waitFor: vi.fn().mockResolvedValue('Element found'),
      getBrowserState: vi.fn(),
      cleanup: vi.fn()
    } as any

    tools = createTools(mockDOMEngine)
  })

  describe('createTools', () => {
    it('应该返回工具数组', () => {
      expect(Array.isArray(tools)).toBe(true)
      expect(tools.length).toBeGreaterThan(0)
    })

    it('应该包含所有必需的工具', () => {
      const toolNames = tools.map(t => t.name)

      expect(toolNames).toContain('click')
      expect(toolNames).toContain('type')
      expect(toolNames).toContain('select')
      expect(toolNames).toContain('scroll')
      expect(toolNames).toContain('hover')
      expect(toolNames).toContain('keyboard')
      expect(toolNames).toContain('wait')
      expect(toolNames).toContain('wait_for')
      expect(toolNames).toContain('ask_user')
      expect(toolNames).toContain('done')
    })

    it('每个工具应该有必需的属性', () => {
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name')
        expect(tool).toHaveProperty('description')
        expect(tool).toHaveProperty('parameters')
        expect(tool).toHaveProperty('execute')
        expect(typeof tool.name).toBe('string')
        expect(typeof tool.description).toBe('string')
        expect(typeof tool.parameters).toBe('object')
        expect(typeof tool.execute).toBe('function')
      })
    })
  })

  describe('click 工具', () => {
    it('应该调用 domEngine.click', async () => {
      const clickTool = tools.find(t => t.name === 'click')!

      await clickTool.execute({ index: 5 })

      expect(mockDOMEngine.click).toHaveBeenCalledWith(5)
    })

    it('应该返回执行结果', async () => {
      const clickTool = tools.find(t => t.name === 'click')!

      const result = await clickTool.execute({ index: 0 })

      expect(result).toBe('Clicked element 0')
    })

    it('应该有正确的参数定义', () => {
      const clickTool = tools.find(t => t.name === 'click')!

      expect(clickTool.parameters.type).toBe('object')
      expect(clickTool.parameters.properties).toHaveProperty('index')
      expect(clickTool.parameters.required).toContain('index')
    })
  })

  describe('type 工具', () => {
    it('应该调用 domEngine.type', async () => {
      const typeTool = tools.find(t => t.name === 'type')!

      await typeTool.execute({ index: 3, text: 'Hello World' })

      expect(mockDOMEngine.type).toHaveBeenCalledWith(3, 'Hello World')
    })

    it('应该返回执行结果', async () => {
      const typeTool = tools.find(t => t.name === 'type')!

      const result = await typeTool.execute({ index: 0, text: 'test' })

      expect(result).toBe('Typed text into element 0')
    })

    it('应该有正确的参数定义', () => {
      const typeTool = tools.find(t => t.name === 'type')!

      expect(typeTool.parameters.properties).toHaveProperty('index')
      expect(typeTool.parameters.properties).toHaveProperty('text')
      expect(typeTool.parameters.required).toContain('index')
      expect(typeTool.parameters.required).toContain('text')
    })
  })

  describe('select 工具', () => {
    it('应该调用 domEngine.select', async () => {
      const selectTool = tools.find(t => t.name === 'select')!

      await selectTool.execute({ index: 2, option: 'Option 1' })

      expect(mockDOMEngine.select).toHaveBeenCalledWith(2, 'Option 1')
    })

    it('应该返回执行结果', async () => {
      const selectTool = tools.find(t => t.name === 'select')!

      const result = await selectTool.execute({ index: 0, option: 'test' })

      expect(result).toBe('Selected option in element 0')
    })

    it('应该有正确的参数定义', () => {
      const selectTool = tools.find(t => t.name === 'select')!

      expect(selectTool.parameters.properties).toHaveProperty('index')
      expect(selectTool.parameters.properties).toHaveProperty('option')
      expect(selectTool.parameters.required).toContain('index')
      expect(selectTool.parameters.required).toContain('option')
    })
  })

  describe('scroll 工具', () => {
    it('应该调用 domEngine.scroll 向下滚动', async () => {
      const scrollTool = tools.find(t => t.name === 'scroll')!

      await scrollTool.execute({ direction: 'down', pages: 2 })

      expect(mockDOMEngine.scroll).toHaveBeenCalledWith('down', 2)
    })

    it('应该调用 domEngine.scroll 向上滚动', async () => {
      const scrollTool = tools.find(t => t.name === 'scroll')!

      await scrollTool.execute({ direction: 'up' })

      expect(mockDOMEngine.scroll).toHaveBeenCalledWith('up', 1)
    })

    it('应该使用默认页数 1', async () => {
      const scrollTool = tools.find(t => t.name === 'scroll')!

      await scrollTool.execute({ direction: 'down' })

      expect(mockDOMEngine.scroll).toHaveBeenCalledWith('down', 1)
    })

    it('应该有正确的参数定义', () => {
      const scrollTool = tools.find(t => t.name === 'scroll')!

      expect(scrollTool.parameters.properties).toHaveProperty('direction')
      expect(scrollTool.parameters.properties).toHaveProperty('pages')
      expect(scrollTool.parameters.required).toContain('direction')
    })
  })

  describe('hover 工具', () => {
    it('应该调用 domEngine.hover', async () => {
      const hoverTool = tools.find(t => t.name === 'hover')!

      await hoverTool.execute({ index: 7 })

      expect(mockDOMEngine.hover).toHaveBeenCalledWith(7)
    })

    it('应该返回执行结果', async () => {
      const hoverTool = tools.find(t => t.name === 'hover')!

      const result = await hoverTool.execute({ index: 0 })

      expect(result).toBe('Hovered over element 0')
    })

    it('应该有正确的参数定义', () => {
      const hoverTool = tools.find(t => t.name === 'hover')!

      expect(hoverTool.parameters.properties).toHaveProperty('index')
      expect(hoverTool.parameters.required).toContain('index')
    })
  })

  describe('keyboard 工具', () => {
    it('应该调用 domEngine.keyboard', async () => {
      const keyboardTool = tools.find(t => t.name === 'keyboard')!

      await keyboardTool.execute({ index: 4, key: 'Enter' })

      expect(mockDOMEngine.keyboard).toHaveBeenCalledWith(4, 'Enter')
    })

    it('应该支持不同的按键', async () => {
      const keyboardTool = tools.find(t => t.name === 'keyboard')!

      await keyboardTool.execute({ index: 0, key: 'Escape' })

      expect(mockDOMEngine.keyboard).toHaveBeenCalledWith(0, 'Escape')
    })

    it('应该有正确的参数定义', () => {
      const keyboardTool = tools.find(t => t.name === 'keyboard')!

      expect(keyboardTool.parameters.properties).toHaveProperty('index')
      expect(keyboardTool.parameters.properties).toHaveProperty('key')
      expect(keyboardTool.parameters.required).toContain('index')
      expect(keyboardTool.parameters.required).toContain('key')
    })
  })

  describe('wait 工具', () => {
    it('应该调用 domEngine.wait', async () => {
      const waitTool = tools.find(t => t.name === 'wait')!

      await waitTool.execute({ seconds: 3 })

      expect(mockDOMEngine.wait).toHaveBeenCalledWith(3)
    })

    it('应该返回执行结果', async () => {
      const waitTool = tools.find(t => t.name === 'wait')!

      const result = await waitTool.execute({ seconds: 2 })

      expect(result).toBe('Waited for 2 seconds')
    })

    it('应该有正确的参数定义', () => {
      const waitTool = tools.find(t => t.name === 'wait')!

      expect(waitTool.parameters.properties).toHaveProperty('seconds')
      expect((waitTool.parameters.properties as any).seconds).toHaveProperty('minimum', 1)
      expect((waitTool.parameters.properties as any).seconds).toHaveProperty('maximum', 10)
      expect(waitTool.parameters.required).toContain('seconds')
    })
  })

  describe('wait_for 工具', () => {
    it('应该调用 domEngine.waitFor', async () => {
      const waitForTool = tools.find(t => t.name === 'wait_for')!

      await waitForTool.execute({ selector: '.my-element', timeout: 3000 })

      expect(mockDOMEngine.waitFor).toHaveBeenCalledWith('.my-element', 3000)
    })

    it('应该使用默认超时时间', async () => {
      const waitForTool = tools.find(t => t.name === 'wait_for')!

      await waitForTool.execute({ selector: '#test' })

      expect(mockDOMEngine.waitFor).toHaveBeenCalledWith('#test', 5000)
    })

    it('应该有正确的参数定义', () => {
      const waitForTool = tools.find(t => t.name === 'wait_for')!

      expect(waitForTool.parameters.properties).toHaveProperty('selector')
      expect(waitForTool.parameters.properties).toHaveProperty('timeout')
      expect(waitForTool.parameters.required).toContain('selector')
    })
  })

  describe('ask_user 工具', () => {
    it('应该返回友好的错误消息当没有回调时', async () => {
      const askUserTool = tools.find(t => t.name === 'ask_user')!

      const result = await askUserTool.execute({ question: 'What is your name?' })

      expect(result).toBe(
        'ask_user tool is not available. The agent cannot ask questions in this context. Please provide all necessary information upfront.'
      )
    })

    it('应该调用 onAskUser 回调当提供时', async () => {
      const mockCallback = vi.fn().mockResolvedValue('John Doe')
      const toolsWithCallback = createTools(mockDOMEngine, { onAskUser: mockCallback })
      const askUserTool = toolsWithCallback.find(t => t.name === 'ask_user')!

      const result = await askUserTool.execute({ question: 'What is your name?' })

      expect(mockCallback).toHaveBeenCalledWith('What is your name?')
      expect(result).toBe('User answered: John Doe')
    })

    it('应该有正确的参数定义', () => {
      const askUserTool = tools.find(t => t.name === 'ask_user')!

      expect(askUserTool.parameters.properties).toHaveProperty('question')
      expect(askUserTool.parameters.required).toContain('question')
    })
  })

  describe('done 工具', () => {
    it('应该返回完成消息', async () => {
      const doneTool = tools.find(t => t.name === 'done')!

      const result = await doneTool.execute({
        success: true,
        message: 'Task completed successfully'
      })

      expect(result).toBe('Task succeeded: Task completed successfully')
    })

    it('应该处理失败情况', async () => {
      const doneTool = tools.find(t => t.name === 'done')!

      const result = await doneTool.execute({
        success: false,
        message: 'Task failed'
      })

      expect(result).toBe('Task failed: Task failed')
    })

    it('应该有正确的参数定义', () => {
      const doneTool = tools.find(t => t.name === 'done')!

      expect(doneTool.parameters.properties).toHaveProperty('success')
      expect(doneTool.parameters.properties).toHaveProperty('message')
      expect(doneTool.parameters.required).toContain('success')
      expect(doneTool.parameters.required).toContain('message')
    })
  })
})

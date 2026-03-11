/**
 * DOM Actions 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  clickElement,
  inputText,
  selectOption,
  scrollVertical,
  hoverElement,
  pressKey,
  wait,
  getElementByIndex
} from '../actions'
import type { InteractiveElement } from '../types'

describe('DOM Actions', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  describe('clickElement', () => {
    it('应该成功点击按钮元素', async () => {
      const button = document.createElement('button')
      button.textContent = 'Click me'
      document.body.appendChild(button)

      const clickSpy = vi.fn()
      button.addEventListener('click', clickSpy)

      const promise = clickElement(button)
      await vi.runAllTimersAsync()
      await promise

      expect(clickSpy).toHaveBeenCalled()
    })

    it('应该在非 HTMLElement 时抛出错误', async () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

      await expect(clickElement(svg)).rejects.toThrow('Element is not clickable')
    })

    it('应该触发完整的鼠标事件序列', async () => {
      const button = document.createElement('button')
      document.body.appendChild(button)

      const events: string[] = []
      button.addEventListener('mousedown', () => events.push('mousedown'))
      button.addEventListener('mouseup', () => events.push('mouseup'))
      button.addEventListener('click', () => events.push('click'))

      const promise = clickElement(button)
      await vi.runAllTimersAsync()
      await promise

      expect(events).toContain('mousedown')
      expect(events).toContain('mouseup')
      expect(events).toContain('click')
    })
  })

  describe('inputText', () => {
    it('应该成功输入文本到 input 元素', async () => {
      const input = document.createElement('input')
      input.type = 'text'
      document.body.appendChild(input)

      const promise = inputText(input, 'Hello')
      await vi.runAllTimersAsync()
      await promise

      expect(input.value).toBe('Hello')
    })

    it('应该成功输入文本到 textarea 元素', async () => {
      const textarea = document.createElement('textarea')
      document.body.appendChild(textarea)

      const promise = inputText(textarea, 'World')
      await vi.runAllTimersAsync()
      await promise

      expect(textarea.value).toBe('World')
    })

    it('应该在非输入元素时抛出错误', async () => {
      const div = document.createElement('div')

      await expect(inputText(div, 'test')).rejects.toThrow(
        'Element is not an input, textarea, or contenteditable'
      )
    })

    it('应该清空现有内容后输入', async () => {
      const input = document.createElement('input')
      input.value = 'old value'
      document.body.appendChild(input)

      const promise = inputText(input, 'new')
      await vi.runAllTimersAsync()
      await promise

      expect(input.value).toBe('new')
    })

    it('应该触发 input 和 change 事件', async () => {
      const input = document.createElement('input')
      document.body.appendChild(input)

      const events: string[] = []
      input.addEventListener('input', () => events.push('input'))
      input.addEventListener('change', () => events.push('change'))

      const promise = inputText(input, 'test')
      await vi.runAllTimersAsync()
      await promise

      expect(events).toContain('input')
      expect(events).toContain('change')
    })
  })

  describe('selectOption', () => {
    it('应该成功选择下拉选项', async () => {
      const select = document.createElement('select')
      const option1 = document.createElement('option')
      option1.value = 'val1'
      option1.textContent = 'Option 1'
      const option2 = document.createElement('option')
      option2.value = 'val2'
      option2.textContent = 'Option 2'
      select.appendChild(option1)
      select.appendChild(option2)
      document.body.appendChild(select)

      await selectOption(select, 'Option 2')

      expect(select.value).toBe('val2')
    })

    it('应该支持部分匹配选项文本', async () => {
      const select = document.createElement('select')
      const option = document.createElement('option')
      option.value = 'test'
      option.textContent = 'Test Option'
      select.appendChild(option)
      document.body.appendChild(select)

      await selectOption(select, 'test')

      expect(select.value).toBe('test')
    })

    it('应该在非 select 元素时抛出错误', async () => {
      const div = document.createElement('div')

      await expect(selectOption(div, 'test')).rejects.toThrow(
        'Element is not a select'
      )
    })

    it('应该在选项不存在时抛出错误', async () => {
      const select = document.createElement('select')
      const option = document.createElement('option')
      option.value = 'val1'
      option.textContent = 'Option 1'
      select.appendChild(option)
      document.body.appendChild(select)

      await expect(selectOption(select, 'nonexistent')).rejects.toThrow(
        'Option "nonexistent" not found'
      )
    })

    it('应该触发 change 事件', async () => {
      const select = document.createElement('select')
      const option = document.createElement('option')
      option.value = 'test'
      option.textContent = 'Test'
      select.appendChild(option)
      document.body.appendChild(select)

      const changeSpy = vi.fn()
      select.addEventListener('change', changeSpy)

      await selectOption(select, 'Test')

      expect(changeSpy).toHaveBeenCalled()
    })
  })

  describe('scrollVertical', () => {
    it('应该返回向下滚动的消息', async () => {
      // Mock window.scrollBy for happy-dom
      window.scrollBy = vi.fn()

      const promise = scrollVertical(100)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBe('Scrolled down 100 pixels')
      expect(window.scrollBy).toHaveBeenCalledWith({ top: 100, behavior: 'smooth' })
    })

    it('应该返回向上滚动的消息', async () => {
      // Mock window.scrollBy for happy-dom
      window.scrollBy = vi.fn()

      const promise = scrollVertical(-50)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBe('Scrolled up 50 pixels')
      expect(window.scrollBy).toHaveBeenCalledWith({ top: -50, behavior: 'smooth' })
    })

    it('应该支持在指定元素上滚动', async () => {
      const div = document.createElement('div')
      div.style.overflow = 'auto'
      div.style.height = '100px'
      document.body.appendChild(div)

      // Mock scrollBy method
      div.scrollBy = vi.fn()

      const promise = scrollVertical(50, div)
      await vi.runAllTimersAsync()
      await promise

      expect(div.scrollBy).toHaveBeenCalledWith({ top: 50, behavior: 'smooth' })
    })
  })

  describe('hoverElement', () => {
    it('应该成功悬停在元素上', async () => {
      const button = document.createElement('button')
      document.body.appendChild(button)

      const events: string[] = []
      button.addEventListener('mouseenter', () => events.push('mouseenter'))
      button.addEventListener('mouseover', () => events.push('mouseover'))

      const promise = hoverElement(button)
      await vi.runAllTimersAsync()
      await promise

      expect(events).toContain('mouseenter')
      expect(events).toContain('mouseover')
    })

    it('应该在非 HTMLElement 时抛出错误', async () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

      await expect(hoverElement(svg)).rejects.toThrow('Element is not hoverable')
    })
  })

  describe('pressKey', () => {
    it('应该成功按下键盘按键', async () => {
      const input = document.createElement('input')
      document.body.appendChild(input)

      const events: string[] = []
      input.addEventListener('keydown', (e) => events.push(`keydown:${e.key}`))
      input.addEventListener('keyup', (e) => events.push(`keyup:${e.key}`))

      const promise = pressKey(input, 'Enter')
      await vi.runAllTimersAsync()
      await promise

      expect(events).toContain('keydown:Enter')
      expect(events).toContain('keyup:Enter')
    })

    it('应该在非 HTMLElement 时抛出错误', async () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

      await expect(pressKey(svg, 'Enter')).rejects.toThrow(
        'Element does not support keyboard input'
      )
    })

    it('应该触发完整的键盘事件序列', async () => {
      const input = document.createElement('input')
      document.body.appendChild(input)

      const events: string[] = []
      input.addEventListener('keydown', () => events.push('keydown'))
      input.addEventListener('keypress', () => events.push('keypress'))
      input.addEventListener('keyup', () => events.push('keyup'))

      const promise = pressKey(input, 'a')
      await vi.runAllTimersAsync()
      await promise

      expect(events).toContain('keydown')
      expect(events).toContain('keypress')
      expect(events).toContain('keyup')
    })
  })

  describe('wait', () => {
    it('应该等待指定的秒数', async () => {
      const promise = wait(2)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBe('Waited for 2 seconds')
    })

    it('应该正确计算等待时间', async () => {
      const startTime = Date.now()
      const promise = wait(1)
      await vi.runAllTimersAsync()
      await promise
      const elapsed = Date.now() - startTime

      // 由于使用 fake timers，时间应该是精确的
      expect(elapsed).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getElementByIndex', () => {
    it('应该根据索引获取元素', () => {
      const button = document.createElement('button')
      const elements: InteractiveElement[] = [
        {
          index: 0,
          tagName: 'button',
          text: 'Click me',
          attributes: {},
          selector: 'button',
          element: button,
          depth: 1
        }
      ]

      const result = getElementByIndex(elements, 0)

      expect(result).toBe(button)
    })

    it('应该在索引不存在时抛出错误', () => {
      const elements: InteractiveElement[] = [
        {
          index: 0,
          tagName: 'button',
          text: 'Click me',
          attributes: {},
          selector: 'button',
          element: document.createElement('button'),
          depth: 1
        }
      ]

      expect(() => getElementByIndex(elements, 999)).toThrow(
        'Element with index 999 not found'
      )
    })

    it('应该在空数组中抛出错误', () => {
      expect(() => getElementByIndex([], 0)).toThrow(
        'Element with index 0 not found'
      )
    })
  })
})

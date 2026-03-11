/**
 * DOM Parser 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { elementsToText, cleanupHighlights, parseDOM, getPageInfo } from '../parser'
import type { InteractiveElement } from '../types'

describe('DOM Parser', () => {
  beforeEach(() => {
    // 清理 DOM
    document.body.innerHTML = ''
  })

  describe('elementsToText', () => {
    it('应该返回 <empty> 当元素列表为空', () => {
      const result = elementsToText([])
      expect(result).toBe('<empty>')
    })

    it('应该正确格式化单个元素', () => {
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

      const result = elementsToText(elements)
      expect(result).toBe('[0]<button> Click me')
    })

    it('应该正确格式化多个元素', () => {
      const elements: InteractiveElement[] = [
        {
          index: 0,
          tagName: 'button',
          text: 'Click me',
          attributes: {},
          selector: 'button',
          element: document.createElement('button'),
          depth: 1
        },
        {
          index: 1,
          tagName: 'input',
          type: 'text',
          text: '',
          attributes: {},
          selector: 'input',
          element: document.createElement('input'),
          depth: 1
        }
      ]

      const result = elementsToText(elements)
      const lines = result.split('\n')
      expect(lines).toHaveLength(2)
      expect(lines[0]).toBe('[0]<button> Click me')
      expect(lines[1]).toBe('[1]<input type="text">')
    })

    it('应该正确处理层级缩进', () => {
      const elements: InteractiveElement[] = [
        {
          index: 0,
          tagName: 'div',
          text: 'Parent',
          attributes: {},
          selector: 'div',
          element: document.createElement('div'),
          depth: 1
        },
        {
          index: 1,
          tagName: 'button',
          text: 'Child',
          attributes: {},
          selector: 'div > button',
          element: document.createElement('button'),
          depth: 2
        },
        {
          index: 2,
          tagName: 'span',
          text: 'Nested',
          attributes: {},
          selector: 'div > button > span',
          element: document.createElement('span'),
          depth: 3
        }
      ]

      const result = elementsToText(elements)
      const lines = result.split('\n')
      expect(lines[0]).toBe('[0]<div> Parent')
      expect(lines[1]).toBe('\t[1]<button> Child')
      expect(lines[2]).toBe('\t\t[2]<span> Nested')
    })

    it('应该包含 type 属性', () => {
      const elements: InteractiveElement[] = [
        {
          index: 0,
          tagName: 'input',
          type: 'password',
          text: '',
          attributes: {},
          selector: 'input',
          element: document.createElement('input'),
          depth: 1
        }
      ]

      const result = elementsToText(elements)
      expect(result).toContain('type="password"')
    })

    it('应该在 includeAttributes 为 true 时包含属性', () => {
      const input = document.createElement('input')
      input.id = 'username'
      input.className = 'form-control'
      input.name = 'user'

      const elements: InteractiveElement[] = [
        {
          index: 0,
          tagName: 'input',
          type: 'text',
          text: '',
          attributes: {
            id: 'username',
            class: 'form-control',
            name: 'user'
          },
          selector: 'input#username',
          element: input,
          depth: 1
        }
      ]

      const result = elementsToText(elements, true)
      expect(result).toContain('id="username"')
      expect(result).toContain('class="form-control"')
      expect(result).toContain('name="user"')
    })

    it('应该标记新元素', () => {
      const elements: InteractiveElement[] = [
        {
          index: 0,
          tagName: 'button',
          text: 'Old',
          attributes: {},
          selector: 'button',
          element: document.createElement('button'),
          depth: 1,
          isNew: false
        },
        {
          index: 1,
          tagName: 'button',
          text: 'New',
          attributes: {},
          selector: 'button',
          element: document.createElement('button'),
          depth: 1,
          isNew: true
        }
      ]

      const result = elementsToText(elements)
      const lines = result.split('\n')
      expect(lines[0]).toBe('[0]<button> Old')
      expect(lines[1]).toBe('*[1]<button> New')
    })

    it('应该处理空文本', () => {
      const elements: InteractiveElement[] = [
        {
          index: 0,
          tagName: 'button',
          text: '',
          attributes: {},
          selector: 'button',
          element: document.createElement('button'),
          depth: 1
        }
      ]

      const result = elementsToText(elements)
      expect(result).toBe('[0]<button>')
    })

    it('应该处理父元素索引', () => {
      const elements: InteractiveElement[] = [
        {
          index: 0,
          tagName: 'div',
          text: 'Parent',
          attributes: {},
          selector: 'div',
          element: document.createElement('div'),
          depth: 1
        },
        {
          index: 1,
          tagName: 'button',
          text: 'Child',
          attributes: {},
          selector: 'div > button',
          element: document.createElement('button'),
          depth: 2,
          parentIndex: 0
        }
      ]

      const result = elementsToText(elements)
      expect(result).toContain('[0]<div>')
      expect(result).toContain('[1]<button>')
    })
  })

  describe('cleanupHighlights', () => {
    it('应该移除所有 data-bee-agent-index 属性', () => {
      document.body.innerHTML = `
        <button data-bee-agent-index="0">Button 1</button>
        <button data-bee-agent-index="1">Button 2</button>
        <input data-bee-agent-index="2" type="text" />
      `

      cleanupHighlights()

      const elements = document.querySelectorAll('[data-bee-agent-index]')
      expect(elements.length).toBe(0)
    })

    it('应该不影响其他属性', () => {
      document.body.innerHTML = `
        <button id="btn" class="primary" data-bee-agent-index="0">Button</button>
      `

      const button = document.querySelector('button')!
      cleanupHighlights()

      expect(button.id).toBe('btn')
      expect(button.className).toBe('primary')
      expect(button.hasAttribute('data-bee-agent-index')).toBe(false)
    })

    it('应该处理空 DOM', () => {
      document.body.innerHTML = ''
      expect(() => cleanupHighlights()).not.toThrow()
    })
  })

  describe('parseDOM', () => {
    it('应该提取可交互元素', () => {
      // 注意：happy-dom 环境中，元素需要有实际的尺寸才能被识别为可见
      // 我们通过设置 viewportExpansion: -1 来跳过视口检查
      document.body.innerHTML = `
        <button>Click me</button>
        <input type="text" />
        <a href="#">Link</a>
        <div>Not interactive</div>
      `

      // Mock getBoundingClientRect 以确保元素有尺寸
      const buttons = document.querySelectorAll('button, input, a')
      buttons.forEach(el => {
        vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
          width: 100,
          height: 30,
          top: 0,
          left: 0,
          bottom: 30,
          right: 100,
          x: 0,
          y: 0,
          toJSON: () => ({})
        })
      })

      const elements = parseDOM({ viewportExpansion: -1 })

      expect(elements.length).toBeGreaterThanOrEqual(3)
      expect(elements.some(el => el.tagName === 'button')).toBe(true)
      expect(elements.some(el => el.tagName === 'input')).toBe(true)
      expect(elements.some(el => el.tagName === 'a')).toBe(true)
    })

    it('应该过滤不可见元素', () => {
      document.body.innerHTML = `
        <button style="display: none;">Hidden</button>
        <button style="visibility: hidden;">Hidden</button>
        <button style="opacity: 0;">Hidden</button>
        <button>Visible</button>
      `

      // Mock getBoundingClientRect for visible button
      const visibleButton = document.querySelectorAll('button')[3]
      vi.spyOn(visibleButton, 'getBoundingClientRect').mockReturnValue({
        width: 100,
        height: 30,
        top: 0,
        left: 0,
        bottom: 30,
        right: 100,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })

      const elements = parseDOM({ viewportExpansion: -1 })

      expect(elements.length).toBe(1)
      expect(elements[0].text).toBe('Visible')
    })

    it('应该应用黑名单过滤', () => {
      document.body.innerHTML = `
        <button class="ignore-me">Ignored</button>
        <button class="keep-me">Kept</button>
      `

      // Mock getBoundingClientRect
      const buttons = document.querySelectorAll('button')
      buttons.forEach(el => {
        vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
          width: 100,
          height: 30,
          top: 0,
          left: 0,
          bottom: 30,
          right: 100,
          x: 0,
          y: 0,
          toJSON: () => ({})
        })
      })

      const elements = parseDOM({
        blacklist: ['.ignore-me'],
        viewportExpansion: -1
      })

      expect(elements.length).toBe(1)
      expect(elements[0].text).toBe('Kept')
    })

    it('应该添加 data-bee-agent-index 属性', () => {
      document.body.innerHTML = `
        <button>Button 1</button>
        <button>Button 2</button>
      `

      // Mock getBoundingClientRect
      const buttons = document.querySelectorAll('button')
      buttons.forEach(el => {
        vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
          width: 100,
          height: 30,
          top: 0,
          left: 0,
          bottom: 30,
          right: 100,
          x: 0,
          y: 0,
          toJSON: () => ({})
        })
      })

      parseDOM({ viewportExpansion: -1 })

      expect(buttons[0].getAttribute('data-bee-agent-index')).toBe('0')
      expect(buttons[1].getAttribute('data-bee-agent-index')).toBe('1')
    })

    it('应该提取元素属性', () => {
      document.body.innerHTML = `
        <input id="username" class="form-control" name="user" placeholder="Enter name" />
      `

      const input = document.querySelector('input')!
      vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({
        width: 100,
        height: 30,
        top: 0,
        left: 0,
        bottom: 30,
        right: 100,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })

      const elements = parseDOM({ viewportExpansion: -1 })

      expect(elements.length).toBe(1)
      expect(elements[0].attributes.id).toBe('username')
      expect(elements[0].attributes.class).toBe('form-control')
      expect(elements[0].attributes.name).toBe('user')
      expect(elements[0].attributes.placeholder).toBe('Enter name')
    })

    it('应该识别 role 属性', () => {
      document.body.innerHTML = `
        <div role="button">Custom Button</div>
      `

      const div = document.querySelector('div')!
      vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({
        width: 100,
        height: 30,
        top: 0,
        left: 0,
        bottom: 30,
        right: 100,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })

      const elements = parseDOM({ viewportExpansion: -1 })

      expect(elements.length).toBeGreaterThanOrEqual(1)
      expect(elements.some(el => el.text === 'Custom Button')).toBe(true)
    })

    it('应该识别 onclick 属性', () => {
      document.body.innerHTML = `
        <div onclick="alert('clicked')">Clickable Div</div>
      `

      const div = document.querySelector('div')!
      vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({
        width: 100,
        height: 30,
        top: 0,
        left: 0,
        bottom: 30,
        right: 100,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })

      const elements = parseDOM({ viewportExpansion: -1 })

      expect(elements.length).toBeGreaterThanOrEqual(1)
      expect(elements.some(el => el.text === 'Clickable Div')).toBe(true)
    })
  })

  describe('getPageInfo', () => {
    it('应该返回页面信息', () => {
      const pageInfo = getPageInfo()

      expect(pageInfo).toHaveProperty('viewportWidth')
      expect(pageInfo).toHaveProperty('viewportHeight')
      expect(pageInfo).toHaveProperty('pageWidth')
      expect(pageInfo).toHaveProperty('pageHeight')
      expect(pageInfo).toHaveProperty('scrollX')
      expect(pageInfo).toHaveProperty('scrollY')
      expect(pageInfo).toHaveProperty('pixelsAbove')
      expect(pageInfo).toHaveProperty('pixelsBelow')
    })

    it('应该返回正确的数值类型', () => {
      const pageInfo = getPageInfo()

      expect(typeof pageInfo.viewportWidth).toBe('number')
      expect(typeof pageInfo.viewportHeight).toBe('number')
      expect(typeof pageInfo.pageWidth).toBe('number')
      expect(typeof pageInfo.pageHeight).toBe('number')
      expect(typeof pageInfo.scrollX).toBe('number')
      expect(typeof pageInfo.scrollY).toBe('number')
      expect(typeof pageInfo.pixelsAbove).toBe('number')
      expect(typeof pageInfo.pixelsBelow).toBe('number')
    })

    it('应该计算正确的 pixelsAbove', () => {
      const pageInfo = getPageInfo()

      expect(pageInfo.pixelsAbove).toBe(pageInfo.scrollY)
    })

    it('应该计算正确的 pixelsBelow', () => {
      const pageInfo = getPageInfo()

      const expected = Math.max(0, pageInfo.pageHeight - pageInfo.scrollY - pageInfo.viewportHeight)
      expect(pageInfo.pixelsBelow).toBe(expected)
    })
  })
})

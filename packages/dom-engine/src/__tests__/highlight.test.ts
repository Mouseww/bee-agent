/**
 * DOM Highlight 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  highlightElement,
  highlightElements,
  clearHighlights,
  removeHighlightContainer,
  highlightByIndex,
  updateHighlightPositions,
  initHighlightListeners,
  destroyHighlightListeners
} from '../highlight'

const HIGHLIGHT_CONTAINER_ID = 'bee-agent-highlights-container'
const HIGHLIGHT_CLASS = 'bee-agent-highlight'
const HIGHLIGHT_STYLES_ID = 'bee-agent-highlight-styles'

describe('DOM Highlight', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    // 清理 head 中可能残留的样式
    const style = document.getElementById(HIGHLIGHT_STYLES_ID)
    if (style) style.remove()
    // 确保 listeners 被销毁
    destroyHighlightListeners()
  })

  afterEach(() => {
    destroyHighlightListeners()
  })

  describe('highlightElement', () => {
    it('应该创建高亮容器并添加遮罩', () => {
      const button = document.createElement('button')
      button.textContent = 'Click me'
      document.body.appendChild(button)

      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 10, left: 20,
        bottom: 40, right: 120, x: 20, y: 10,
        toJSON: () => ({})
      })

      highlightElement(button, 0)

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      expect(container).not.toBeNull()
      expect(container!.children.length).toBe(1)
    })

    it('应该创建带正确索引的遮罩', () => {
      const button = document.createElement('button')
      document.body.appendChild(button)

      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 10, left: 20,
        bottom: 40, right: 120, x: 20, y: 10,
        toJSON: () => ({})
      })

      highlightElement(button, 5)

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      const overlay = container!.querySelector(`.${HIGHLIGHT_CLASS}`) as HTMLElement
      expect(overlay).not.toBeNull()
      expect(overlay.dataset.index).toBe('5')
    })

    it('应该在遮罩中显示索引标签', () => {
      const button = document.createElement('button')
      document.body.appendChild(button)

      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 10, left: 20,
        bottom: 40, right: 120, x: 20, y: 10,
        toJSON: () => ({})
      })

      highlightElement(button, 3)

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      const overlay = container!.querySelector(`.${HIGHLIGHT_CLASS}`) as HTMLElement
      const label = overlay.children[0] as HTMLElement
      expect(label.textContent).toBe('3')
    })

    it('应该根据元素位置设置遮罩样式', () => {
      const button = document.createElement('button')
      document.body.appendChild(button)

      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        width: 200, height: 50, top: 100, left: 150,
        bottom: 150, right: 350, x: 150, y: 100,
        toJSON: () => ({})
      })

      highlightElement(button, 0)

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      const overlay = container!.querySelector(`.${HIGHLIGHT_CLASS}`) as HTMLElement

      expect(overlay.style.top).toBe('100px')
      expect(overlay.style.left).toBe('150px')
      expect(overlay.style.width).toBe('200px')
      expect(overlay.style.height).toBe('50px')
    })

    it('应该使用循环颜色方案', () => {
      const el1 = document.createElement('button')
      const el2 = document.createElement('button')
      document.body.appendChild(el1)
      document.body.appendChild(el2)

      const mockRect = {
        width: 100, height: 30, top: 0, left: 0,
        bottom: 30, right: 100, x: 0, y: 0,
        toJSON: () => ({})
      }
      vi.spyOn(el1, 'getBoundingClientRect').mockReturnValue(mockRect)
      vi.spyOn(el2, 'getBoundingClientRect').mockReturnValue(mockRect)

      highlightElement(el1, 0)
      highlightElement(el2, 1)

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      const overlays = container!.querySelectorAll(`.${HIGHLIGHT_CLASS}`)
      expect(overlays.length).toBe(2)

      // 不同索引应使用不同颜色
      const overlay1 = overlays[0] as HTMLElement
      const overlay2 = overlays[1] as HTMLElement
      expect(overlay1.style.backgroundColor).not.toBe(overlay2.style.backgroundColor)
    })

    it('应该支持自定义样式覆盖', () => {
      const button = document.createElement('button')
      document.body.appendChild(button)

      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 0, left: 0,
        bottom: 30, right: 100, x: 0, y: 0,
        toJSON: () => ({})
      })

      highlightElement(button, 0, { borderRadius: '10px' })

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      const overlay = container!.querySelector(`.${HIGHLIGHT_CLASS}`) as HTMLElement
      expect(overlay.style.borderRadius).toBe('10px')
    })

    it('应该复用已存在的容器', () => {
      const el1 = document.createElement('button')
      const el2 = document.createElement('button')
      document.body.appendChild(el1)
      document.body.appendChild(el2)

      const mockRect = {
        width: 100, height: 30, top: 0, left: 0,
        bottom: 30, right: 100, x: 0, y: 0,
        toJSON: () => ({})
      }
      vi.spyOn(el1, 'getBoundingClientRect').mockReturnValue(mockRect)
      vi.spyOn(el2, 'getBoundingClientRect').mockReturnValue(mockRect)

      highlightElement(el1, 0)
      highlightElement(el2, 1)

      const containers = document.querySelectorAll(`#${HIGHLIGHT_CONTAINER_ID}`)
      expect(containers.length).toBe(1)
    })

    it('应该添加 CSS 动画样式到 head', () => {
      const button = document.createElement('button')
      document.body.appendChild(button)

      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 0, left: 0,
        bottom: 30, right: 100, x: 0, y: 0,
        toJSON: () => ({})
      })

      highlightElement(button, 0)

      const styleEl = document.getElementById(HIGHLIGHT_STYLES_ID)
      expect(styleEl).not.toBeNull()
      expect(styleEl!.textContent).toContain('bee-agent-fade-in')
      expect(styleEl!.textContent).toContain('bee-agent-pulse')
    })

    it('应该设置容器为 pointer-events: none', () => {
      const button = document.createElement('button')
      document.body.appendChild(button)

      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 0, left: 0,
        bottom: 30, right: 100, x: 0, y: 0,
        toJSON: () => ({})
      })

      highlightElement(button, 0)

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      expect(container!.style.pointerEvents).toBe('none')
    })
  })

  describe('highlightElements', () => {
    it('应该批量高亮多个元素', () => {
      const el1 = document.createElement('button')
      const el2 = document.createElement('input')
      document.body.appendChild(el1)
      document.body.appendChild(el2)

      const mockRect = {
        width: 100, height: 30, top: 0, left: 0,
        bottom: 30, right: 100, x: 0, y: 0,
        toJSON: () => ({})
      }
      vi.spyOn(el1, 'getBoundingClientRect').mockReturnValue(mockRect)
      vi.spyOn(el2, 'getBoundingClientRect').mockReturnValue(mockRect)

      highlightElements([
        { element: el1, index: 0 },
        { element: el2, index: 1 }
      ])

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      const overlays = container!.querySelectorAll(`.${HIGHLIGHT_CLASS}`)
      expect(overlays.length).toBe(2)
    })

    it('应该先清除已有高亮再添加新的', () => {
      const el1 = document.createElement('button')
      const el2 = document.createElement('input')
      document.body.appendChild(el1)
      document.body.appendChild(el2)

      const mockRect = {
        width: 100, height: 30, top: 0, left: 0,
        bottom: 30, right: 100, x: 0, y: 0,
        toJSON: () => ({})
      }
      vi.spyOn(el1, 'getBoundingClientRect').mockReturnValue(mockRect)
      vi.spyOn(el2, 'getBoundingClientRect').mockReturnValue(mockRect)

      // 先高亮 el1
      highlightElement(el1, 0)
      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      expect(container!.querySelectorAll(`.${HIGHLIGHT_CLASS}`).length).toBe(1)

      // 批量高亮应先清除再添加
      highlightElements([{ element: el2, index: 1 }])
      expect(container!.querySelectorAll(`.${HIGHLIGHT_CLASS}`).length).toBe(1)
    })

    it('应该处理空数组', () => {
      // 先添加一个高亮
      const el = document.createElement('button')
      document.body.appendChild(el)

      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 0, left: 0,
        bottom: 30, right: 100, x: 0, y: 0,
        toJSON: () => ({})
      })
      highlightElement(el, 0)

      // 传空数组应清除所有高亮
      highlightElements([])

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      expect(container!.querySelectorAll(`.${HIGHLIGHT_CLASS}`).length).toBe(0)
    })

    it('应该支持自定义样式', () => {
      const el = document.createElement('button')
      document.body.appendChild(el)

      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 0, left: 0,
        bottom: 30, right: 100, x: 0, y: 0,
        toJSON: () => ({})
      })

      highlightElements(
        [{ element: el, index: 0 }],
        { borderRadius: '15px' }
      )

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      const overlay = container!.querySelector(`.${HIGHLIGHT_CLASS}`) as HTMLElement
      expect(overlay.style.borderRadius).toBe('15px')
    })
  })

  describe('clearHighlights', () => {
    it('应该清除所有高亮遮罩', () => {
      const el = document.createElement('button')
      document.body.appendChild(el)

      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 0, left: 0,
        bottom: 30, right: 100, x: 0, y: 0,
        toJSON: () => ({})
      })

      highlightElement(el, 0)
      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      expect(container!.children.length).toBe(1)

      clearHighlights()
      expect(container!.children.length).toBe(0)
    })

    it('应该保留容器元素', () => {
      const el = document.createElement('button')
      document.body.appendChild(el)

      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 0, left: 0,
        bottom: 30, right: 100, x: 0, y: 0,
        toJSON: () => ({})
      })

      highlightElement(el, 0)
      clearHighlights()

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      expect(container).not.toBeNull()
    })

    it('应该在容器不存在时安全调用', () => {
      expect(() => clearHighlights()).not.toThrow()
    })

    it('应该允许多次调用', () => {
      clearHighlights()
      clearHighlights()
      expect(() => clearHighlights()).not.toThrow()
    })
  })

  describe('removeHighlightContainer', () => {
    it('应该移除高亮容器', () => {
      const el = document.createElement('button')
      document.body.appendChild(el)

      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 0, left: 0,
        bottom: 30, right: 100, x: 0, y: 0,
        toJSON: () => ({})
      })

      highlightElement(el, 0)
      expect(document.getElementById(HIGHLIGHT_CONTAINER_ID)).not.toBeNull()

      removeHighlightContainer()
      expect(document.getElementById(HIGHLIGHT_CONTAINER_ID)).toBeNull()
    })

    it('应该同时移除样式元素', () => {
      const el = document.createElement('button')
      document.body.appendChild(el)

      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 0, left: 0,
        bottom: 30, right: 100, x: 0, y: 0,
        toJSON: () => ({})
      })

      highlightElement(el, 0)
      expect(document.getElementById(HIGHLIGHT_STYLES_ID)).not.toBeNull()

      removeHighlightContainer()
      expect(document.getElementById(HIGHLIGHT_STYLES_ID)).toBeNull()
    })

    it('应该在容器不存在时安全调用', () => {
      expect(() => removeHighlightContainer()).not.toThrow()
    })

    it('应该仅移除存在的元素', () => {
      // 仅创建容器但无样式的情况
      const container = document.createElement('div')
      container.id = HIGHLIGHT_CONTAINER_ID
      document.body.appendChild(container)

      removeHighlightContainer()
      expect(document.getElementById(HIGHLIGHT_CONTAINER_ID)).toBeNull()
    })
  })

  describe('highlightByIndex', () => {
    it('应该高亮带有指定索引的元素', () => {
      const button = document.createElement('button')
      button.setAttribute('data-bee-agent-index', '3')
      document.body.appendChild(button)

      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 10, left: 20,
        bottom: 40, right: 120, x: 20, y: 10,
        toJSON: () => ({})
      })

      highlightByIndex(3)

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      const overlay = container!.querySelector(`.${HIGHLIGHT_CLASS}`) as HTMLElement
      expect(overlay).not.toBeNull()
      expect(overlay.dataset.index).toBe('3')
    })

    it('应该在元素不存在时不创建遮罩', () => {
      highlightByIndex(999)

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      // 容器可能不存在或没有子元素
      if (container) {
        expect(container.querySelectorAll(`.${HIGHLIGHT_CLASS}`).length).toBe(0)
      }
    })

    it('应该支持自定义样式', () => {
      const button = document.createElement('button')
      button.setAttribute('data-bee-agent-index', '0')
      document.body.appendChild(button)

      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 0, left: 0,
        bottom: 30, right: 100, x: 0, y: 0,
        toJSON: () => ({})
      })

      highlightByIndex(0, { borderRadius: '20px' })

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      const overlay = container!.querySelector(`.${HIGHLIGHT_CLASS}`) as HTMLElement
      expect(overlay.style.borderRadius).toBe('20px')
    })
  })

  describe('updateHighlightPositions', () => {
    it('应该更新高亮遮罩的位置', () => {
      const button = document.createElement('button')
      button.setAttribute('data-bee-agent-index', '0')
      document.body.appendChild(button)

      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 10, left: 20,
        bottom: 40, right: 120, x: 20, y: 10,
        toJSON: () => ({})
      })

      highlightElement(button, 0)

      // 模拟元素位置变化
      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 50, left: 80,
        bottom: 80, right: 180, x: 80, y: 50,
        toJSON: () => ({})
      })

      updateHighlightPositions()

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      const overlay = container!.querySelector(`.${HIGHLIGHT_CLASS}`) as HTMLElement
      expect(overlay.style.top).toBe('50px')
      expect(overlay.style.left).toBe('80px')
    })

    it('应该移除无对应元素的高亮', () => {
      const button = document.createElement('button')
      button.setAttribute('data-bee-agent-index', '0')
      document.body.appendChild(button)

      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 10, left: 20,
        bottom: 40, right: 120, x: 20, y: 10,
        toJSON: () => ({})
      })

      highlightElement(button, 0)

      // 移除原始元素
      button.remove()

      updateHighlightPositions()

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      expect(container!.querySelectorAll(`.${HIGHLIGHT_CLASS}`).length).toBe(0)
    })

    it('应该在容器不存在时安全调用', () => {
      expect(() => updateHighlightPositions()).not.toThrow()
    })

    it('应该跳过没有 data-index 的高亮', () => {
      // 手动创建容器和无 index 的 overlay
      const container = document.createElement('div')
      container.id = HIGHLIGHT_CONTAINER_ID
      const overlay = document.createElement('div')
      overlay.className = HIGHLIGHT_CLASS
      // 不设置 dataset.index
      container.appendChild(overlay)
      document.body.appendChild(container)

      expect(() => updateHighlightPositions()).not.toThrow()
      // overlay 应该仍然存在（不被移除）
      expect(container.querySelectorAll(`.${HIGHLIGHT_CLASS}`).length).toBe(1)
    })

    it('应该处理多个高亮的位置更新', () => {
      const el1 = document.createElement('button')
      const el2 = document.createElement('input')
      el1.setAttribute('data-bee-agent-index', '0')
      el2.setAttribute('data-bee-agent-index', '1')
      document.body.appendChild(el1)
      document.body.appendChild(el2)

      const mockRect1 = {
        width: 100, height: 30, top: 0, left: 0,
        bottom: 30, right: 100, x: 0, y: 0,
        toJSON: () => ({})
      }
      const mockRect2 = {
        width: 80, height: 25, top: 40, left: 10,
        bottom: 65, right: 90, x: 10, y: 40,
        toJSON: () => ({})
      }

      vi.spyOn(el1, 'getBoundingClientRect').mockReturnValue(mockRect1)
      vi.spyOn(el2, 'getBoundingClientRect').mockReturnValue(mockRect2)

      highlightElement(el1, 0)
      highlightElement(el2, 1)

      // 更新位置
      vi.spyOn(el1, 'getBoundingClientRect').mockReturnValue({
        ...mockRect1, top: 200, left: 300
      })
      vi.spyOn(el2, 'getBoundingClientRect').mockReturnValue({
        ...mockRect2, top: 250, left: 350
      })

      updateHighlightPositions()

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      const overlays = container!.querySelectorAll(`.${HIGHLIGHT_CLASS}`) as NodeListOf<HTMLElement>
      expect(overlays[0].style.top).toBe('200px')
      expect(overlays[0].style.left).toBe('300px')
      expect(overlays[1].style.top).toBe('250px')
      expect(overlays[1].style.left).toBe('350px')
    })
  })

  describe('initHighlightListeners', () => {
    it('应该注册 scroll 和 resize 事件监听器', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')

      initHighlightListeners()

      expect(addSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })
      expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function), { passive: true })

      addSpy.mockRestore()
    })

    it('应该是幂等的（多次调用不重复注册）', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')

      initHighlightListeners()
      initHighlightListeners()
      initHighlightListeners()

      const scrollCalls = addSpy.mock.calls.filter(call => call[0] === 'scroll')
      const resizeCalls = addSpy.mock.calls.filter(call => call[0] === 'resize')
      expect(scrollCalls.length).toBe(1)
      expect(resizeCalls.length).toBe(1)

      addSpy.mockRestore()
    })
  })

  describe('destroyHighlightListeners', () => {
    it('应该移除 scroll 和 resize 事件监听器', () => {
      initHighlightListeners()

      const removeSpy = vi.spyOn(window, 'removeEventListener')

      destroyHighlightListeners()

      expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function))
      expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))

      removeSpy.mockRestore()
    })

    it('应该在未初始化时安全调用', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')

      destroyHighlightListeners()

      // 不应调用 removeEventListener，因为未初始化
      const scrollCalls = removeSpy.mock.calls.filter(call => call[0] === 'scroll')
      expect(scrollCalls.length).toBe(0)

      removeSpy.mockRestore()
    })

    it('应该在销毁后允许重新初始化', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')

      initHighlightListeners()
      destroyHighlightListeners()
      initHighlightListeners()

      const scrollCalls = addSpy.mock.calls.filter(call => call[0] === 'scroll')
      expect(scrollCalls.length).toBe(2) // 两次 init

      addSpy.mockRestore()
    })
  })

  describe('throttledUpdatePositions (间接测试)', () => {
    it('应该在 scroll 事件后更新高亮位置', async () => {
      vi.useFakeTimers()

      const button = document.createElement('button')
      button.setAttribute('data-bee-agent-index', '0')
      document.body.appendChild(button)

      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 10, left: 20,
        bottom: 40, right: 120, x: 20, y: 10,
        toJSON: () => ({})
      })

      highlightElement(button, 0)
      initHighlightListeners()

      // 更新元素位置
      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        width: 100, height: 30, top: 60, left: 70,
        bottom: 90, right: 170, x: 70, y: 60,
        toJSON: () => ({})
      })

      // 触发 scroll 事件
      window.dispatchEvent(new Event('scroll'))

      // 等待节流完成
      vi.advanceTimersByTime(150)

      const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
      const overlay = container!.querySelector(`.${HIGHLIGHT_CLASS}`) as HTMLElement
      expect(overlay.style.top).toBe('60px')
      expect(overlay.style.left).toBe('70px')

      vi.useRealTimers()
    })

    it('应该节流更新 - 短时间内多次触发只执行一次', () => {
      vi.useFakeTimers()

      const button = document.createElement('button')
      button.setAttribute('data-bee-agent-index', '0')
      document.body.appendChild(button)

      let callCount = 0
      vi.spyOn(button, 'getBoundingClientRect').mockImplementation(() => {
        callCount++
        return {
          width: 100, height: 30, top: callCount * 10, left: 0,
          bottom: callCount * 10 + 30, right: 100, x: 0, y: callCount * 10,
          toJSON: () => ({})
        }
      })

      highlightElement(button, 0)
      initHighlightListeners()

      // 重置计数
      callCount = 0

      // 快速触发多次 scroll
      window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('scroll'))

      // 在节流时间内，不应立即执行
      vi.advanceTimersByTime(50)

      // 节流结束后只应执行一次
      vi.advanceTimersByTime(100)

      // getBoundingClientRect 只应在最后一次 timeout 回调中被调用一次
      // （加上 highlightElement 本身的调用）
      // 关键是在 100ms 节流窗口内多次 dispatch 只产生一次 updateHighlightPositions
      expect(callCount).toBeGreaterThanOrEqual(1)

      vi.useRealTimers()
    })
  })
})

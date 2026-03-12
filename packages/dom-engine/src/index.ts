/**
 * BeeAgent DOM Engine
 * @module @bee-agent/dom-engine
 * @description DOM 解析和操作引擎，负责提取页面可交互元素并执行各类 DOM 操作
 *
 * @example
 * ```ts
 * import { DOMEngine } from '@bee-agent/dom-engine'
 *
 * const engine = new DOMEngine({
 *   viewportExpansion: 200,
 *   showHighlightMask: true
 * })
 *
 * // 获取浏览器状态
 * const state = engine.getBrowserState()
 *
 * // 执行操作
 * await engine.click(5)
 * await engine.type(3, 'Hello World')
 * ```
 */

export * from './types'
export * from './parser'
export * from './actions'
export * from './highlight'

import type { InteractiveElement, DOMEngineConfig, BrowserState } from './types'
import { parseDOM, cleanupHighlights, elementsToText, getPageInfo } from './parser'
import { clickElement, inputText, selectOption, scrollVertical, getElementByIndex, hoverElement, pressKey, waitForElement, wait } from './actions'
import { highlightElements, clearHighlights as clearHighlightOverlays, removeHighlightContainer, initHighlightListeners, destroyHighlightListeners } from './highlight'

/**
 * DOM 引擎主类
 * @description 封装 DOM 解析、操作、高亮的完整生命周期管理
 */
export class DOMEngine {
  private config: DOMEngineConfig
  private elements: InteractiveElement[] = []

  constructor(config: DOMEngineConfig = {}) {
    this.config = config
    // 初始化高亮事件监听
    initHighlightListeners()
  }

  /**
   * 更新 DOM 树快照
   * @description 重新扫描页面，返回可交互元素的文本描述
   * @returns 可交互元素的文本表示
   */
  updateTree(): string {
    cleanupHighlights()
    this.elements = parseDOM(this.config)

    // 如果启用高亮遮罩，显示高亮
    if (this.config.showHighlightMask) {
      const elementsToHighlight = this.elements.map(el => ({ element: el.element, index: el.index }))
      highlightElements(elementsToHighlight)
    }

    return elementsToText(this.elements, this.config.includeAttributes)
  }

  /**
   * 获取完整的浏览器状态快照
   * @description 包含页面信息、可交互元素列表、滚动状态等
   * @returns 浏览器状态对象
   */
  getBrowserState(): BrowserState {
    const content = this.updateTree()
    const pageInfo = getPageInfo()
    const url = window.location.href
    const title = document.title

    const pagesAbove = pageInfo.pixelsAbove / pageInfo.viewportHeight
    const pagesBelow = pageInfo.pixelsBelow / pageInfo.viewportHeight
    const totalPages = pageInfo.pageHeight / pageInfo.viewportHeight
    const currentPosition = pageInfo.pageHeight > 0
      ? (pageInfo.scrollY / pageInfo.pageHeight * 100).toFixed(0)
      : '0'

    const titleLine = `Current Page: [${title}](${url})`
    const pageInfoLine = `Page info: ${pageInfo.viewportWidth}x${pageInfo.viewportHeight}px viewport, ${pageInfo.pageWidth}x${pageInfo.pageHeight}px total, ${pagesAbove.toFixed(1)} pages above, ${pagesBelow.toFixed(1)} pages below, ${totalPages.toFixed(1)} total pages, at ${currentPosition}% of page`

    const hasContentAbove = pageInfo.pixelsAbove > 4
    const hasContentBelow = pageInfo.pixelsBelow > 4

    const scrollHintAbove = hasContentAbove
      ? `... ${pageInfo.pixelsAbove} pixels above (${pagesAbove.toFixed(1)} pages) - scroll to see more ...`
      : '[Start of page]'

    const footer = hasContentBelow
      ? `... ${pageInfo.pixelsBelow} pixels below (${pagesBelow.toFixed(1)} pages) - scroll to see more ...`
      : '[End of page]'

    const header = `${titleLine}\n${pageInfoLine}\n\nInteractive elements:\n\n${scrollHintAbove}`

    return { url, title, header, content, footer }
  }

  /**
   * 点击元素
   * @param index - 元素索引
   * @returns 操作结果描述
   */
  async click(index: number): Promise<string> {
    const element = getElementByIndex(this.elements, index)
    await clickElement(element)
    return `Clicked element [${index}]`
  }

  /**
   * 输入文本
   * @param index - 元素索引
   * @param text - 要输入的文本
   * @returns 操作结果描述
   */
  async type(index: number, text: string): Promise<string> {
    const element = getElementByIndex(this.elements, index)
    await inputText(element, text)
    return `Input text "${text}" into element [${index}]`
  }

  /**
   * 选择下拉选项
   * @param index - 元素索引
   * @param optionText - 选项文本
   * @returns 操作结果描述
   */
  async select(index: number, optionText: string): Promise<string> {
    const element = getElementByIndex(this.elements, index)
    await selectOption(element, optionText)
    return `Selected option "${optionText}" in element [${index}]`
  }

  /**
   * 滚动页面
   * @param direction - 滚动方向
   * @param pages - 滚动页数，默认 1
   * @returns 操作结果描述
   */
  async scroll(direction: 'up' | 'down', pages = 1): Promise<string> {
    const safePags = Math.min(Math.max(pages, 0.1), 10)
    const pixels = safePags * window.innerHeight * (direction === 'down' ? 1 : -1)
    return await scrollVertical(pixels)
  }

  /**
   * 悬停在元素上
   * @param index - 元素索引
   * @returns 操作结果描述
   */
  async hover(index: number): Promise<string> {
    const element = getElementByIndex(this.elements, index)
    await hoverElement(element)
    return `Hovered over element [${index}]`
  }

  /**
   * 模拟按键
   * @param index - 元素索引
   * @param key - 按键名称
   * @returns 操作结果描述
   */
  async keyboard(index: number, key: string): Promise<string> {
    const element = getElementByIndex(this.elements, index)
    await pressKey(element, key)
    return `Pressed key "${key}" on element [${index}]`
  }

  /**
   * 等待元素出现
   * @param selector - CSS 选择器
   * @param timeout - 超时时间（毫秒）
   * @returns 操作结果描述
   */
  async waitFor(selector: string, timeout = 5000): Promise<string> {
    await waitForElement(selector, timeout)
    return `Element "${selector}" appeared`
  }

  /**
   * 等待指定时间
   * @param seconds - 等待秒数
   * @returns 操作结果描述
   */
  async wait(seconds: number): Promise<string> {
    return await wait(seconds)
  }

  /**
   * 获取当前已解析的元素列表
   * @returns 可交互元素列表的副本
   */
  getElements(): InteractiveElement[] {
    return [...this.elements]
  }

  /**
   * 清理所有状态，释放资源
   */
  cleanup(): void {
    cleanupHighlights()
    clearHighlightOverlays()
    removeHighlightContainer()
    destroyHighlightListeners()
    this.elements = []
  }
}

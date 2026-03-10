/**
 * BeeAgent DOM Engine
 * DOM 解析和操作引擎
 */

export * from './types'
export * from './parser'
export * from './actions'

import type { InteractiveElement, DOMEngineConfig, BrowserState } from './types'
import { parseDOM, cleanupHighlights, elementsToText, getPageInfo } from './parser'
import { clickElement, inputText, selectOption, scrollVertical, getElementByIndex } from './actions'

/**
 * DOM 引擎主类
 */
export class DOMEngine {
  private config: DOMEngineConfig
  private elements: InteractiveElement[] = []

  constructor(config: DOMEngineConfig = {}) {
    this.config = config
  }

  /**
   * 更新 DOM 树
   */
  updateTree(): string {
    cleanupHighlights()
    this.elements = parseDOM(this.config)
    return elementsToText(this.elements, this.config.includeAttributes)
  }

  /**
   * 获取浏览器状态
   */
  getBrowserState(): BrowserState {
    const content = this.updateTree()
    const pageInfo = getPageInfo()
    const url = window.location.href
    const title = document.title

    const pagesAbove = pageInfo.pixelsAbove / pageInfo.viewportHeight
    const pagesBelow = pageInfo.pixelsBelow / pageInfo.viewportHeight
    const totalPages = pageInfo.pageHeight / pageInfo.viewportHeight
    const currentPosition = (pageInfo.scrollY / pageInfo.pageHeight * 100).toFixed(0)

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
   */
  async click(index: number): Promise<string> {
    const element = getElementByIndex(this.elements, index)
    await clickElement(element)
    return `Clicked element [${index}]`
  }

  /**
   * 输入文本
   */
  async type(index: number, text: string): Promise<string> {
    const element = getElementByIndex(this.elements, index)
    await inputText(element, text)
    return `Input text "${text}" into element [${index}]`
  }

  /**
   * 选择选项
   */
  async select(index: number, optionText: string): Promise<string> {
    const element = getElementByIndex(this.elements, index)
    await selectOption(element, optionText)
    return `Selected option "${optionText}" in element [${index}]`
  }

  /**
   * 滚动
   */
  async scroll(direction: 'up' | 'down', pages = 1): Promise<string> {
    const pixels = pages * window.innerHeight * (direction === 'down' ? 1 : -1)
    return await scrollVertical(pixels)
  }

  /**
   * 清理
   */
  cleanup(): void {
    cleanupHighlights()
    this.elements = []
  }
}

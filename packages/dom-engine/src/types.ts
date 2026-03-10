/**
 * DOM 引擎类型定义
 */

export interface InteractiveElement {
  /** 元素索引 */
  index: number
  /** 元素标签名 */
  tagName: string
  /** 元素类型 */
  type?: string
  /** 元素文本内容 */
  text?: string
  /** 元素属性 */
  attributes: Record<string, string>
  /** 元素选择器 */
  selector: string
  /** DOM 元素引用 */
  element: Element
}

export interface PageInfo {
  /** 视口宽度 */
  viewportWidth: number
  /** 视口高度 */
  viewportHeight: number
  /** 页面总宽度 */
  pageWidth: number
  /** 页面总高度 */
  pageHeight: number
  /** 当前滚动位置 */
  scrollX: number
  scrollY: number
  /** 视口上方像素数 */
  pixelsAbove: number
  /** 视口下方像素数 */
  pixelsBelow: number
}

export interface DOMEngineConfig {
  /** 视口扩展范围（-1 表示全页面） */
  viewportExpansion?: number
  /** 是否包含元素属性 */
  includeAttributes?: boolean
  /** 黑名单选择器 */
  blacklist?: string[]
}

export interface BrowserState {
  url: string
  title: string
  header: string
  content: string
  footer: string
}

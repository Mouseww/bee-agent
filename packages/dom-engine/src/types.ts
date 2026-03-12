/**
 * BeeAgent DOM 引擎类型定义
 * @module @bee-agent/dom-engine
 * @description 定义 DOM 解析、交互元素、页面信息等核心数据结构
 */

/**
 * 可交互元素信息
 * @description 从 DOM 树中提取的可交互元素，包含定位、文本、属性等信息
 */
export interface InteractiveElement {
  /** 元素索引，用于后续操作引用 */
  index: number
  /** 元素标签名（小写），如 'button', 'input', 'a' */
  tagName: string
  /** 元素 type 属性值，如 'text', 'submit', 'checkbox' */
  type?: string
  /** 元素文本内容（已截断，最长 100 字符） */
  text?: string
  /** 关键属性集合（id, class, name, placeholder, aria-label, title, alt, href） */
  attributes: Record<string, string>
  /** CSS 选择器，用于重新定位元素 */
  selector: string
  /** DOM 元素引用 */
  element: Element
  /** 在 DOM 树中的嵌套深度 */
  depth: number
  /** 父元素索引（如果父元素也是可交互的） */
  parentIndex?: number
  /** 是否为新出现的元素（相对于上一次扫描） */
  isNew?: boolean
}

/**
 * 页面布局与滚动信息
 * @description 用于判断当前视口位置和可滚动区域
 */
export interface PageInfo {
  /** 视口宽度（像素） */
  viewportWidth: number
  /** 视口高度（像素） */
  viewportHeight: number
  /** 页面总宽度（像素） */
  pageWidth: number
  /** 页面总高度（像素） */
  pageHeight: number
  /** 当前水平滚动位置 */
  scrollX: number
  /** 当前垂直滚动位置 */
  scrollY: number
  /** 视口上方的像素数 */
  pixelsAbove: number
  /** 视口下方的像素数 */
  pixelsBelow: number
}

/**
 * DOM 引擎配置
 * @description 控制 DOM 解析行为和高亮显示
 * @example
 * ```ts
 * const config: DOMEngineConfig = {
 *   viewportExpansion: 200,
 *   includeAttributes: true,
 *   blacklist: ['.ad-container', '#cookie-banner'],
 *   showHighlightMask: true
 * }
 * ```
 */
export interface DOMEngineConfig {
  /** 视口扩展范围（像素），-1 表示扫描全页面，默认 100 */
  viewportExpansion?: number
  /** 是否在文本输出中包含元素属性，默认 false */
  includeAttributes?: boolean
  /** 黑名单选择器列表，匹配的元素将被跳过 */
  blacklist?: string[]
  /** 是否显示高亮遮罩层标注索引，默认 false */
  showHighlightMask?: boolean
  /** 是否扫描 Shadow DOM 内部元素（暂未实现，预留接口） */
  scanShadowDOM?: boolean
  /** 是否扫描 iframe 内部元素（暂未实现，预留接口） */
  scanIframes?: boolean
}

/**
 * 浏览器状态快照
 * @description Agent 每步观察阶段获取的完整页面状态
 */
export interface BrowserState {
  /** 当前页面 URL */
  url: string
  /** 当前页面标题 */
  title: string
  /** 页面头部信息（标题、URL、页面尺寸、滚动提示） */
  header: string
  /** 可交互元素列表的文本表示 */
  content: string
  /** 页面底部滚动提示 */
  footer: string
}

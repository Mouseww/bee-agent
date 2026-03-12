/**
 * DOM 解析器 - 提取可交互元素
 * @module @bee-agent/dom-engine
 * @description 扫描 DOM 树，识别并提取可交互元素，生成结构化描述
 */

import type { InteractiveElement, DOMEngineConfig, PageInfo } from './types'

/** 可交互的 HTML 标签名 */
const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea', 'label'])

/** 可交互的 ARIA role 值 */
const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'textbox', 'checkbox', 'radio',
  'combobox', 'tab', 'menuitem', 'option', 'switch'
])

/**
 * 转义 CSS 选择器中的特殊字符
 * @param value - 需要转义的字符串
 * @returns 转义后的字符串
 */
function escapeCSSSelector(value: string): string {
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1')
}

/**
 * 判断元素是否可交互
 * @param element - 待检测的 DOM 元素
 * @returns 是否为可交互元素
 */
function isInteractive(element: Element): boolean {
  const tagName = element.tagName.toLowerCase()

  // 标签判断
  if (INTERACTIVE_TAGS.has(tagName)) return true

  // role 判断
  const role = element.getAttribute('role')
  if (role && INTERACTIVE_ROLES.has(role)) return true

  // 可点击判断
  if (element.hasAttribute('onclick')) return true
  if (element.classList.contains('clickable')) return true

  // contenteditable
  if (element.getAttribute('contenteditable') === 'true') return true

  // cursor:pointer 判断
  if (element instanceof HTMLElement) {
    const style = window.getComputedStyle(element)
    if (style.cursor === 'pointer') return true
  }

  // tabindex >= 0 判断
  const tabindex = element.getAttribute('tabindex')
  if (tabindex !== null) {
    const parsed = parseInt(tabindex, 10)
    if (!isNaN(parsed) && parsed >= 0) return true
  }

  return false
}

/**
 * 判断元素是否在视口范围内
 * @param element - 待检测的 DOM 元素
 * @param expansion - 视口扩展范围（像素），-1 表示全页面模式
 * @returns 是否在视口内
 */
function isInViewport(element: Element, expansion = 0): boolean {
  if (expansion === -1) return true // 全页面模式

  const rect = element.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth

  return (
    rect.top < viewportHeight + expansion &&
    rect.bottom > -expansion &&
    rect.left < viewportWidth + expansion &&
    rect.right > -expansion
  )
}

/**
 * 判断元素是否可见
 * @param element - 待检测的 DOM 元素
 * @returns 是否可见
 */
function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false

  const style = window.getComputedStyle(element)
  if (style.display === 'none') return false
  if (style.visibility === 'hidden') return false
  if (style.opacity === '0') return false

  const rect = element.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return false

  return true
}

/**
 * 生成元素的 CSS 选择器路径
 * @description 优先使用 ID 选择器，回退使用标签+类名组合路径
 * @param element - 目标 DOM 元素
 * @returns CSS 选择器字符串
 */
function generateSelector(element: Element): string {
  // 优先使用 ID（需要转义特殊字符）
  if (element.id) {
    return `#${escapeCSSSelector(element.id)}`
  }

  const path: string[] = []
  let current: Element | null = element

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase()

    if (current.className && typeof current.className === 'string') {
      const classes = Array.from(current.classList)
        .filter(c => c && !c.startsWith('bee-agent-'))
        .slice(0, 2)
      if (classes.length > 0) {
        selector += '.' + classes.map(escapeCSSSelector).join('.')
      }
    }

    path.unshift(selector)
    current = current.parentElement
  }

  return path.join(' > ')
}

/**
 * 提取元素的文本描述
 * @description 按优先级获取：aria-label > title > 特定元素属性 > textContent
 * @param element - 目标 DOM 元素
 * @returns 文本描述（最长 100 字符）
 */
function extractText(element: Element): string {
  // 优先使用 aria-label
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel) return ariaLabel.trim().slice(0, 100)

  // 其次使用 title
  const title = element.getAttribute('title')
  if (title) return title.trim().slice(0, 100)

  // 图片使用 alt
  if (element instanceof HTMLImageElement) {
    return (element.alt || element.title || '').slice(0, 100)
  }

  // 链接使用 textContent 或 href
  if (element instanceof HTMLAnchorElement) {
    return (element.textContent?.trim() || element.title || element.href || '').slice(0, 100)
  }

  // input 使用 value 或 placeholder
  if (element instanceof HTMLInputElement) {
    return (element.value || element.placeholder || element.title || '').slice(0, 100)
  }

  // select 使用选中项文本
  if (element instanceof HTMLSelectElement) {
    const selected = element.selectedOptions[0]
    return selected ? (selected.textContent?.trim() || '').slice(0, 100) : ''
  }

  // 按钮使用文本
  if (element instanceof HTMLButtonElement) {
    return (element.textContent?.trim() || '').slice(0, 100)
  }

  const text = element.textContent?.trim() || ''
  return text.slice(0, 100)
}

/**
 * 获取当前页面布局与滚动信息
 * @returns 页面信息对象
 */
export function getPageInfo(): PageInfo {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const pageWidth = document.documentElement.scrollWidth
  const pageHeight = document.documentElement.scrollHeight
  const scrollX = window.scrollX
  const scrollY = window.scrollY

  return {
    viewportWidth,
    viewportHeight,
    pageWidth,
    pageHeight,
    scrollX,
    scrollY,
    pixelsAbove: scrollY,
    pixelsBelow: Math.max(0, pageHeight - scrollY - viewportHeight)
  }
}

/**
 * 计算元素在 DOM 树中的嵌套深度
 * @param element - 目标 DOM 元素
 * @returns 嵌套层数（相对于 body）
 */
function getElementDepth(element: Element): number {
  let depth = 0
  let current: Element | null = element

  while (current && current !== document.body) {
    depth++
    current = current.parentElement
  }

  return depth
}

/**
 * 查找最近的已索引父元素
 * @param element - 当前元素
 * @param indexedElements - 已索引元素映射表
 * @returns 父元素索引，未找到则返回 undefined
 */
function findParentIndex(element: Element, indexedElements: Map<Element, number>): number | undefined {
  let current: Element | null = element.parentElement

  while (current && current !== document.body) {
    const parentIndex = indexedElements.get(current)
    if (parentIndex !== undefined) {
      return parentIndex
    }
    current = current.parentElement
  }

  return undefined
}

/**
 * 解析 DOM 树，提取可交互元素
 * @description 扫描整个 DOM 树，筛选可交互、可见、在视口内的元素
 * @param config - DOM 引擎配置
 * @returns 可交互元素列表
 */
export function parseDOM(config: DOMEngineConfig = {}): InteractiveElement[] {
  const { viewportExpansion = 100, blacklist = [] } = config

  const elements: InteractiveElement[] = []
  const allElements = document.querySelectorAll('*')
  const indexedElements = new Map<Element, number>()

  let index = 0

  for (const element of allElements) {
    // 跳过 BeeAgent 自身的 UI 元素
    if (element.closest('#bee-agent-ui-root, #bee-agent-highlights-container')) continue

    // 黑名单过滤（安全检查 selector 有效性）
    if (blacklist.length > 0) {
      try {
        if (blacklist.some(selector => element.matches(selector))) continue
      } catch {
        // 忽略无效的选择器
      }
    }

    // 可交互判断
    if (!isInteractive(element)) continue

    // 可见性判断
    if (!isVisible(element)) continue

    // 视口判断
    if (!isInViewport(element, viewportExpansion)) continue

    const tagName = element.tagName.toLowerCase()
    const type = element.getAttribute('type') || undefined
    const text = extractText(element)
    const selector = generateSelector(element)
    const depth = getElementDepth(element)

    const attributes: Record<string, string> = {}
    const ALLOWED_ATTRS = ['id', 'class', 'name', 'placeholder', 'aria-label', 'title', 'alt', 'href', 'value', 'role']
    for (const attr of element.attributes) {
      if (ALLOWED_ATTRS.includes(attr.name)) {
        attributes[attr.name] = attr.value
      }
    }

    // 记录元素索引映射
    indexedElements.set(element, index)

    // 查找父元素索引
    const parentIndex = findParentIndex(element, indexedElements)

    elements.push({
      index,
      tagName,
      type,
      text,
      attributes,
      selector,
      element,
      depth,
      parentIndex
    })

    // 添加高亮标记
    element.setAttribute('data-bee-agent-index', String(index))

    index++
  }

  return elements
}

/**
 * 清理所有高亮标记属性
 */
export function cleanupHighlights(): void {
  const elements = document.querySelectorAll('[data-bee-agent-index]')
  elements.forEach(el => el.removeAttribute('data-bee-agent-index'))
}

/**
 * 将可交互元素列表转换为文本描述（树形层级结构）
 * @description 生成 Agent 可理解的文本格式，包含缩进表示层级关系
 * @param elements - 可交互元素列表
 * @param includeAttributes - 是否包含元素属性
 * @returns 文本描述
 */
export function elementsToText(elements: InteractiveElement[], includeAttributes = false): string {
  if (elements.length === 0) return '<empty>'

  const lines: string[] = []
  const previousElements = new Set<number>()

  for (const el of elements) {
    // 计算缩进（使用 \t 表示层级）
    const indent = '\t'.repeat(Math.max(0, el.depth - 1))

    // 标记新元素（相对于上一次扫描，isNew 由外部设置）
    const isNew = el.isNew === true && !previousElements.has(el.index)
    const prefix = isNew ? '*' : ''

    let line = `${indent}${prefix}[${el.index}]<${el.tagName}`

    if (el.type) line += ` type="${el.type}"`

    if (includeAttributes) {
      for (const [key, value] of Object.entries(el.attributes)) {
        if (value) line += ` ${key}="${value}"`
      }
    }

    line += '>'

    if (el.text) {
      line += ` ${el.text}`
    }

    lines.push(line)
    previousElements.add(el.index)
  }

  return lines.join('\n')
}

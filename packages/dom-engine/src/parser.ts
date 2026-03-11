/**
 * DOM 解析器 - 提取可交互元素
 */

import type { InteractiveElement, DOMEngineConfig, PageInfo } from './types'

const INTERACTIVE_TAGS = ['a', 'button', 'input', 'select', 'textarea', 'label']
const INTERACTIVE_ROLES = ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 'tab']

/**
 * 判断元素是否可交互
 */
function isInteractive(element: Element): boolean {
  const tagName = element.tagName.toLowerCase()

  // 标签判断
  if (INTERACTIVE_TAGS.includes(tagName)) return true

  // role 判断
  const role = element.getAttribute('role')
  if (role && INTERACTIVE_ROLES.includes(role)) return true

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
  if (tabindex !== null && parseInt(tabindex, 10) >= 0) return true

  return false
}

/**
 * 判断元素是否在视口内
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
 * 生成元素选择器
 */
function generateSelector(element: Element): string {
  if (element.id) return `#${element.id}`

  const path: string[] = []
  let current: Element | null = element

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase()

    if (current.className) {
      const classes = Array.from(current.classList)
        .filter(c => c && !c.startsWith('bee-agent-'))
        .slice(0, 2)
      if (classes.length > 0) {
        selector += '.' + classes.join('.')
      }
    }

    path.unshift(selector)
    current = current.parentElement
  }

  return path.join(' > ')
}

/**
 * 提取元素文本
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
    return element.alt || element.title || ''
  }

  // 链接使用 title 或 href
  if (element instanceof HTMLAnchorElement) {
    return element.title || element.textContent?.trim() || element.href || ''
  }

  if (element instanceof HTMLInputElement) {
    return element.value || element.placeholder || element.title || ''
  }

  if (element instanceof HTMLSelectElement) {
    const selected = element.selectedOptions[0]
    return selected ? selected.textContent?.trim() || '' : ''
  }

  // 按钮使用 aria-label 或文本
  if (element instanceof HTMLButtonElement) {
    return element.getAttribute('aria-label') || element.textContent?.trim() || ''
  }

  const text = element.textContent?.trim() || ''
  return text.slice(0, 100) // 限制长度
}

/**
 * 获取页面信息
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
    pixelsBelow: pageHeight - scrollY - viewportHeight
  }
}

/**
 * 计算元素深度
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
 * 查找父元素索引
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
 */
export function parseDOM(config: DOMEngineConfig = {}): InteractiveElement[] {
  const { viewportExpansion = 100, blacklist = [] } = config

  const elements: InteractiveElement[] = []
  const allElements = document.querySelectorAll('*')
  const indexedElements = new Map<Element, number>()

  let index = 0

  for (const element of allElements) {
    // 黑名单过滤
    if (blacklist.some(selector => element.matches(selector))) continue

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
    for (const attr of element.attributes) {
      if (['id', 'class', 'name', 'placeholder', 'aria-label', 'title', 'alt', 'href'].includes(attr.name)) {
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
 * 清理高亮标记
 */
export function cleanupHighlights(): void {
  const elements = document.querySelectorAll('[data-bee-agent-index]')
  elements.forEach(el => el.removeAttribute('data-bee-agent-index'))
}

/**
 * 将元素列表转换为文本描述（树形层级结构）
 */
export function elementsToText(elements: InteractiveElement[], includeAttributes = false): string {
  if (elements.length === 0) return '<empty>'

  const lines: string[] = []
  const previousElements = new Set<number>()

  for (const el of elements) {
    // 计算缩进（使用 \t 表示层级）
    const indent = '\t'.repeat(Math.max(0, el.depth - 1))

    // 标记新元素（相对于上一次扫描）
    const isNew = el.isNew && !previousElements.has(el.index)
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

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
  if (element instanceof HTMLInputElement) {
    return element.value || element.placeholder || ''
  }

  if (element instanceof HTMLSelectElement) {
    const selected = element.selectedOptions[0]
    return selected ? selected.textContent?.trim() || '' : ''
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
 * 解析 DOM 树，提取可交互元素
 */
export function parseDOM(config: DOMEngineConfig = {}): InteractiveElement[] {
  const { viewportExpansion = 100, blacklist = [] } = config

  const elements: InteractiveElement[] = []
  const allElements = document.querySelectorAll('*')

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

    const attributes: Record<string, string> = {}
    for (const attr of element.attributes) {
      if (['id', 'class', 'name', 'placeholder', 'aria-label'].includes(attr.name)) {
        attributes[attr.name] = attr.value
      }
    }

    elements.push({
      index,
      tagName,
      type,
      text,
      attributes,
      selector,
      element
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
 * 将元素列表转换为文本描述
 */
export function elementsToText(elements: InteractiveElement[], includeAttributes = false): string {
  if (elements.length === 0) return '<empty>'

  const lines: string[] = []

  for (const el of elements) {
    let line = `[${el.index}] <${el.tagName}`

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
  }

  return lines.join('\n')
}

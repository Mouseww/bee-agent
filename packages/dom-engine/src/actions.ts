/**
 * DOM 操作执行器
 */

import type { InteractiveElement } from './types'

/**
 * 触发元素的所有事件
 */
function triggerEvents(element: Element, eventType: string): void {
  const event = new Event(eventType, { bubbles: true, cancelable: true })
  element.dispatchEvent(event)
}

/**
 * 点击元素
 */
export async function clickElement(element: Element): Promise<void> {
  if (!(element instanceof HTMLElement)) {
    throw new Error('Element is not clickable')
  }

  // 滚动到元素位置
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  await new Promise(resolve => setTimeout(resolve, 300))

  // 触发事件
  triggerEvents(element, 'mousedown')
  triggerEvents(element, 'mouseup')
  element.click()
  triggerEvents(element, 'click')

  await new Promise(resolve => setTimeout(resolve, 100))
}

/**
 * 输入文本
 */
export async function inputText(element: Element, text: string): Promise<void> {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    throw new Error('Element is not an input or textarea')
  }

  // 聚焦元素
  element.focus()
  await new Promise(resolve => setTimeout(resolve, 100))

  // 清空现有内容
  element.value = ''
  triggerEvents(element, 'input')

  // 逐字输入
  for (const char of text) {
    element.value += char
    triggerEvents(element, 'input')
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  triggerEvents(element, 'change')
  element.blur()
}

/**
 * 选择下拉选项
 */
export async function selectOption(element: Element, optionText: string): Promise<void> {
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error('Element is not a select')
  }

  element.focus()

  // 查找匹配的选项
  const options = Array.from(element.options)
  const option = options.find(opt =>
    opt.textContent?.trim().toLowerCase().includes(optionText.toLowerCase())
  )

  if (!option) {
    throw new Error(`Option "${optionText}" not found`)
  }

  element.value = option.value
  triggerEvents(element, 'change')
  element.blur()
}

/**
 * 垂直滚动
 */
export async function scrollVertical(pixels: number, element?: Element): Promise<string> {
  const target = element instanceof HTMLElement ? element : window

  if (target === window) {
    window.scrollBy({ top: pixels, behavior: 'smooth' })
  } else {
    (target as HTMLElement).scrollBy({ top: pixels, behavior: 'smooth' })
  }

  await new Promise(resolve => setTimeout(resolve, 500))

  const direction = pixels > 0 ? 'down' : 'up'
  return `Scrolled ${direction} ${Math.abs(pixels)} pixels`
}

/**
 * 水平滚动
 */
export async function scrollHorizontal(pixels: number, element?: Element): Promise<string> {
  const target = element instanceof HTMLElement ? element : window

  if (target === window) {
    window.scrollBy({ left: pixels, behavior: 'smooth' })
  } else {
    (target as HTMLElement).scrollBy({ left: pixels, behavior: 'smooth' })
  }

  await new Promise(resolve => setTimeout(resolve, 500))

  const direction = pixels > 0 ? 'right' : 'left'
  return `Scrolled ${direction} ${Math.abs(pixels)} pixels`
}

/**
 * 根据索引获取元素
 */
export function getElementByIndex(elements: InteractiveElement[], index: number): Element {
  const item = elements.find(el => el.index === index)
  if (!item) {
    throw new Error(`Element with index ${index} not found`)
  }
  return item.element
}

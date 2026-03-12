/**
 * DOM 操作执行器
 * @module @bee-agent/dom-engine
 * @description 提供点击、输入、选择、滚动、悬停、按键等 DOM 操作
 */

import type { InteractiveElement } from './types'

/**
 * 触发元素事件（使用 Event 构造器）
 * @param element - 目标元素
 * @param eventType - 事件类型名
 */
function triggerEvents(element: Element, eventType: string): void {
  const event = new Event(eventType, { bubbles: true, cancelable: true })
  element.dispatchEvent(event)
}

/**
 * 使用 React 兼容方式设置 input/textarea 的值
 * @description React 使用内部 value tracker 追踪输入框的值。
 * 直接设置 element.value 不会触发 React 的 onChange，
 * 因为 React 比较的是 tracker 中缓存的旧值。
 * 解决方法：用原始的 HTMLInputElement.prototype.value setter 设值，
 * 绕过 React 的 tracker 劫持，然后派发原生 input 事件。
 */
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  // 获取原始的 value setter（React 劫持前的）
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set

  if (nativeSetter) {
    nativeSetter.call(element, value)
  } else {
    // 兜底：直接赋值
    element.value = value
  }

  // 派发 input 事件（React 16+ 监听的是这个）
  const inputEvent = new Event('input', { bubbles: true, cancelable: true })
  element.dispatchEvent(inputEvent)
}

/**
 * 创建可中止的延迟 Promise
 * @param ms - 延迟毫秒数
 * @returns Promise
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 点击元素
 * @description 先滚动到元素位置，然后模拟完整的鼠标点击事件序列
 * @param element - 目标元素
 * @throws {Error} 元素不是 HTMLElement 时抛出
 */
export async function clickElement(element: Element): Promise<void> {
  if (!(element instanceof HTMLElement)) {
    throw new Error('Element is not clickable')
  }

  // 滚动到元素位置
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  await delay(300)

  // 触发鼠标事件序列（不重复触发 click）
  triggerEvents(element, 'mousedown')
  triggerEvents(element, 'mouseup')
  element.click()

  await delay(100)
}

/**
 * 输入文本到表单元素
 * @description 支持 input、textarea 和 contenteditable 元素。
 * 对 React 受控组件使用 nativeSetter 绕过 value tracker 劫持。
 * @param element - 目标元素
 * @param text - 要输入的文本
 * @throws {Error} 元素不支持文本输入时抛出
 */
export async function inputText(element: Element, text: string): Promise<void> {
  // 支持 contenteditable 元素
  if (element instanceof HTMLElement && element.getAttribute('contenteditable') === 'true') {
    element.focus()
    await delay(100)
    element.textContent = ''
    triggerEvents(element, 'input')

    for (const char of text) {
      element.textContent = (element.textContent || '') + char
      triggerEvents(element, 'input')
      await delay(30)
    }

    triggerEvents(element, 'change')
    element.blur()
    return
  }

  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    throw new Error('Element is not an input, textarea, or contenteditable')
  }

  // 滚动到元素并聚焦
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  await delay(200)
  element.focus()
  triggerEvents(element, 'focus')
  triggerEvents(element, 'focusin')
  await delay(100)

  // 清空现有内容（React 兼容方式）
  setNativeValue(element, '')
  await delay(50)

  // 逐字输入（模拟真实输入 + React 兼容）
  for (const char of text) {
    // 模拟 keydown
    element.dispatchEvent(new KeyboardEvent('keydown', {
      key: char, code: `Key${char.toUpperCase()}`, bubbles: true, cancelable: true
    }))

    // 使用 nativeSetter 设值（绕过 React tracker）
    setNativeValue(element, element.value + char)

    // 模拟 keyup
    element.dispatchEvent(new KeyboardEvent('keyup', {
      key: char, code: `Key${char.toUpperCase()}`, bubbles: true, cancelable: true
    }))

    await delay(30)
  }

  // 最后触发 change（一些框架依赖 blur 时的 change）
  triggerEvents(element, 'change')
}

/**
 * 选择下拉选项
 * @description 在 select 元素中查找并选择匹配的选项
 * @param element - 目标 select 元素
 * @param optionText - 选项文本（模糊匹配，不区分大小写）
 * @throws {Error} 元素不是 select 或选项未找到时抛出
 */
export async function selectOption(element: Element, optionText: string): Promise<void> {
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error('Element is not a select')
  }

  element.focus()

  // 查找匹配的选项（模糊匹配）
  const options = Array.from(element.options)
  const option = options.find(opt =>
    opt.textContent?.trim().toLowerCase().includes(optionText.toLowerCase())
  )

  if (!option) {
    const available = options.map(o => o.textContent?.trim()).filter(Boolean).join(', ')
    throw new Error(`Option "${optionText}" not found. Available options: ${available}`)
  }

  element.value = option.value
  triggerEvents(element, 'change')
  element.blur()
}

/**
 * 垂直滚动页面或元素
 * @param pixels - 滚动像素数（正数向下，负数向上）
 * @param element - 可选的滚动目标元素，默认为 window
 * @returns 滚动操作描述
 */
export async function scrollVertical(pixels: number, element?: Element): Promise<string> {
  const target = element instanceof HTMLElement ? element : window

  if (target === window) {
    window.scrollBy({ top: pixels, behavior: 'smooth' })
  } else {
    (target as HTMLElement).scrollBy({ top: pixels, behavior: 'smooth' })
  }

  await delay(500)

  const direction = pixels > 0 ? 'down' : 'up'
  return `Scrolled ${direction} ${Math.abs(pixels)} pixels`
}

/**
 * 水平滚动页面或元素
 * @param pixels - 滚动像素数（正数向右，负数向左）
 * @param element - 可选的滚动目标元素，默认为 window
 * @returns 滚动操作描述
 */
export async function scrollHorizontal(pixels: number, element?: Element): Promise<string> {
  const target = element instanceof HTMLElement ? element : window

  if (target === window) {
    window.scrollBy({ left: pixels, behavior: 'smooth' })
  } else {
    (target as HTMLElement).scrollBy({ left: pixels, behavior: 'smooth' })
  }

  await delay(500)

  const direction = pixels > 0 ? 'right' : 'left'
  return `Scrolled ${direction} ${Math.abs(pixels)} pixels`
}

/**
 * 悬停在元素上
 * @description 滚动到元素位置并触发 mouseenter/mouseover 事件
 * @param element - 目标元素
 * @throws {Error} 元素不是 HTMLElement 时抛出
 */
export async function hoverElement(element: Element): Promise<void> {
  if (!(element instanceof HTMLElement)) {
    throw new Error('Element is not hoverable')
  }

  // 滚动到元素位置
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  await delay(300)

  // 获取元素中心坐标以构造更真实的事件
  const rect = element.getBoundingClientRect()
  const clientX = rect.left + rect.width / 2
  const clientY = rect.top + rect.height / 2

  const mouseEnterEvent = new MouseEvent('mouseenter', {
    bubbles: false, // mouseenter 不冒泡
    cancelable: true,
    clientX,
    clientY
  })
  const mouseOverEvent = new MouseEvent('mouseover', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY
  })

  element.dispatchEvent(mouseEnterEvent)
  element.dispatchEvent(mouseOverEvent)

  await delay(100)
}

/**
 * 模拟键盘按键
 * @description 触发完整的键盘事件序列：keydown → keypress → keyup
 * @param element - 目标元素
 * @param key - 按键名称，如 'Enter', 'Escape', 'Tab', 'ArrowDown'
 * @throws {Error} 元素不是 HTMLElement 时抛出
 */
export async function pressKey(element: Element, key: string): Promise<void> {
  if (!(element instanceof HTMLElement)) {
    throw new Error('Element does not support keyboard input')
  }

  element.focus()
  await delay(100)

  const eventInit: KeyboardEventInit = {
    key,
    code: key,
    bubbles: true,
    cancelable: true
  }

  element.dispatchEvent(new KeyboardEvent('keydown', eventInit))
  element.dispatchEvent(new KeyboardEvent('keypress', eventInit))
  element.dispatchEvent(new KeyboardEvent('keyup', eventInit))

  await delay(50)
}

/**
 * 等待元素出现
 * @description 轮询 DOM 直到匹配的可见元素出现，或超时
 * @param selector - CSS 选择器
 * @param timeout - 超时时间（毫秒），默认 5000
 * @returns 匹配的元素
 * @throws {Error} 超时未找到时抛出
 */
export async function waitForElement(
  selector: string,
  timeout = 5000
): Promise<Element> {
  // 限制超时范围
  const safeTimeout = Math.min(Math.max(timeout, 500), 30000)
  const startTime = Date.now()

  while (Date.now() - startTime < safeTimeout) {
    const element = document.querySelector(selector)

    if (element) {
      // 检查元素是否可见
      if (element instanceof HTMLElement) {
        const style = window.getComputedStyle(element)
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          return element
        }
      } else {
        return element
      }
    }

    // 等待一小段时间后重试
    await delay(100)
  }

  throw new Error(`Element "${selector}" not found within ${safeTimeout}ms`)
}

/**
 * 等待指定时间
 * @param seconds - 等待秒数（限制在 0.1-30 之间）
 * @returns 等待操作描述
 */
export async function wait(seconds: number): Promise<string> {
  // 限制等待范围
  const safeSeconds = Math.min(Math.max(seconds, 0.1), 30)
  await delay(safeSeconds * 1000)
  return `Waited for ${safeSeconds} seconds`
}

/**
 * 根据索引获取元素
 * @param elements - 可交互元素列表
 * @param index - 元素索引
 * @returns 对应的 DOM 元素
 * @throws {Error} 索引不存在时抛出
 */
export function getElementByIndex(elements: InteractiveElement[], index: number): Element {
  const item = elements.find(el => el.index === index)
  if (!item) {
    throw new Error(`Element with index ${index} not found. Valid indexes: ${elements.map(e => e.index).slice(0, 20).join(', ')}${elements.length > 20 ? '...' : ''}`)
  }
  return item.element
}

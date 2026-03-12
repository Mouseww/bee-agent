/**
 * DOM 高亮遮罩层 - 半透明方块标注索引
 * @module @bee-agent/dom-engine
 * @description 在页面上创建彩色遮罩层，标注可交互元素的索引号
 */

const HIGHLIGHT_CLASS = 'bee-agent-highlight'
const HIGHLIGHT_CONTAINER_ID = 'bee-agent-highlights-container'

/**
 * 高亮样式配置
 */
interface HighlightStyle {
  backgroundColor: string
  borderColor: string
  textColor: string
  fontSize: string
  padding: string
  borderRadius: string
  zIndex: number
}

/** 彩色方案 - 循环使用不同颜色以区分元素 */
const COLOR_SCHEMES = [
  { bg: 'rgba(59, 130, 246, 0.25)', border: 'rgba(37, 99, 235, 0.9)', text: '#fff' },
  { bg: 'rgba(16, 185, 129, 0.25)', border: 'rgba(5, 150, 105, 0.9)', text: '#fff' },
  { bg: 'rgba(245, 158, 11, 0.25)', border: 'rgba(217, 119, 6, 0.9)', text: '#fff' },
  { bg: 'rgba(239, 68, 68, 0.25)', border: 'rgba(220, 38, 38, 0.9)', text: '#fff' },
  { bg: 'rgba(168, 85, 247, 0.25)', border: 'rgba(147, 51, 234, 0.9)', text: '#fff' },
  { bg: 'rgba(236, 72, 153, 0.25)', border: 'rgba(219, 39, 119, 0.9)', text: '#fff' },
  { bg: 'rgba(20, 184, 166, 0.25)', border: 'rgba(13, 148, 136, 0.9)', text: '#fff' },
  { bg: 'rgba(251, 191, 36, 0.25)', border: 'rgba(245, 158, 11, 0.9)', text: '#000' }
] as const

/** 默认高亮样式 */
const DEFAULT_STYLE: HighlightStyle = {
  backgroundColor: 'rgba(59, 130, 246, 0.25)',
  borderColor: 'rgba(37, 99, 235, 0.9)',
  textColor: '#fff',
  fontSize: '12px',
  padding: '2px 6px',
  borderRadius: '3px',
  zIndex: 999999
}

/**
 * 确保高亮容器存在
 * @returns 高亮容器元素
 */
function ensureHighlightContainer(): HTMLElement {
  let container = document.getElementById(HIGHLIGHT_CONTAINER_ID)

  if (!container) {
    container = document.createElement('div')
    container.id = HIGHLIGHT_CONTAINER_ID
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: ${DEFAULT_STYLE.zIndex};
      overflow: visible;
    `

    // 添加 CSS 动画
    const style = document.createElement('style')
    style.id = 'bee-agent-highlight-styles'
    style.textContent = `
      @keyframes bee-agent-fade-in {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      @keyframes bee-agent-pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.6;
        }
      }

      .${HIGHLIGHT_CLASS}:hover {
        filter: brightness(1.1);
      }
    `

    // 避免重复添加样式
    if (!document.getElementById('bee-agent-highlight-styles')) {
      document.head.appendChild(style)
    }
    document.body.appendChild(container)
  }

  return container
}

/**
 * 为元素添加高亮遮罩
 * @param element - 目标 DOM 元素
 * @param index - 元素索引
 * @param style - 可选的自定义样式
 */
export function highlightElement(element: Element, index: number, style: Partial<HighlightStyle> = {}): void {
  const container = ensureHighlightContainer()
  const rect = element.getBoundingClientRect()

  // 创建遮罩层（使用 fixed 定位，不受滚动影响）
  const overlay = document.createElement('div')
  overlay.className = HIGHLIGHT_CLASS
  overlay.dataset.index = String(index)

  // 使用彩色方案循环
  const colorScheme = COLOR_SCHEMES[index % COLOR_SCHEMES.length]
  const finalStyle = {
    ...DEFAULT_STYLE,
    backgroundColor: colorScheme.bg,
    borderColor: colorScheme.border,
    textColor: colorScheme.text,
    ...style
  }

  overlay.style.cssText = `
    position: fixed;
    top: ${rect.top}px;
    left: ${rect.left}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    background-color: ${finalStyle.backgroundColor};
    border: 2px solid ${finalStyle.borderColor};
    border-radius: ${finalStyle.borderRadius};
    pointer-events: none;
    box-sizing: border-box;
    transition: all 0.2s ease;
    animation: bee-agent-fade-in 0.3s ease;
  `

  // 创建索引标签
  const label = document.createElement('div')
  label.style.cssText = `
    position: absolute;
    top: -2px;
    left: -2px;
    background-color: ${finalStyle.borderColor};
    color: ${finalStyle.textColor};
    font-size: ${finalStyle.fontSize};
    font-weight: bold;
    padding: ${finalStyle.padding};
    border-radius: ${finalStyle.borderRadius};
    font-family: monospace;
    line-height: 1;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  `
  label.textContent = String(index)

  overlay.appendChild(label)
  container.appendChild(overlay)
}

/**
 * 批量高亮元素
 * @description 先清除现有高亮，再批量添加新的高亮
 * @param elements - 要高亮的元素列表
 * @param style - 可选的自定义样式
 */
export function highlightElements(elements: Array<{ element: Element; index: number }>, style?: Partial<HighlightStyle>): void {
  clearHighlights()

  for (const { element, index } of elements) {
    highlightElement(element, index, style)
  }
}

/**
 * 清除所有高亮遮罩
 */
export function clearHighlights(): void {
  const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
  if (container) {
    container.innerHTML = ''
  }
}

/**
 * 移除高亮容器及相关样式
 */
export function removeHighlightContainer(): void {
  const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
  if (container) {
    container.remove()
  }
  const style = document.getElementById('bee-agent-highlight-styles')
  if (style) {
    style.remove()
  }
}

/**
 * 高亮特定索引的元素
 * @param index - 元素索引
 * @param style - 可选的自定义样式
 */
export function highlightByIndex(index: number, style?: Partial<HighlightStyle>): void {
  const element = document.querySelector(`[data-bee-agent-index="${index}"]`)
  if (element) {
    highlightElement(element, index, style)
  }
}

/**
 * 更新所有高亮遮罩的位置
 * @description 在页面滚动或窗口大小变化时调用，保持遮罩与元素对齐
 */
export function updateHighlightPositions(): void {
  const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
  if (!container) return

  const highlights = container.querySelectorAll<HTMLElement>(`.${HIGHLIGHT_CLASS}`)

  for (const highlight of highlights) {
    const index = highlight.dataset.index
    if (!index) continue

    const element = document.querySelector(`[data-bee-agent-index="${index}"]`)
    if (!element) {
      // 元素不存在了，移除高亮
      highlight.remove()
      continue
    }

    const rect = element.getBoundingClientRect()

    highlight.style.top = `${rect.top}px`
    highlight.style.left = `${rect.left}px`
    highlight.style.width = `${rect.width}px`
    highlight.style.height = `${rect.height}px`
  }
}

/**
 * 高亮位置更新的事件监听管理器
 * @description 避免在模块加载时直接注册全局事件监听器（兼容 SSR/测试环境），
 *              提供显式的 init/destroy 生命周期管理
 */
let scrollTimeout: ReturnType<typeof setTimeout> | null = null
let isListenerAttached = false

/** 节流处理的高亮位置更新回调 */
function throttledUpdatePositions(): void {
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
  scrollTimeout = setTimeout(() => {
    updateHighlightPositions()
  }, 100)
}

/**
 * 初始化高亮位置的事件监听
 * @description 注册 scroll 和 resize 事件监听器，多次调用是安全的（幂等）
 */
export function initHighlightListeners(): void {
  if (isListenerAttached) return
  if (typeof window === 'undefined') return

  window.addEventListener('scroll', throttledUpdatePositions, { passive: true })
  window.addEventListener('resize', throttledUpdatePositions, { passive: true })
  isListenerAttached = true
}

/**
 * 销毁高亮位置的事件监听
 * @description 移除 scroll 和 resize 事件监听器，释放资源
 */
export function destroyHighlightListeners(): void {
  if (!isListenerAttached) return
  if (typeof window === 'undefined') return

  window.removeEventListener('scroll', throttledUpdatePositions)
  window.removeEventListener('resize', throttledUpdatePositions)

  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
    scrollTimeout = null
  }
  isListenerAttached = false
}

/**
 * DOM 高亮遮罩层 - 半透明方块标注索引
 */

const HIGHLIGHT_CLASS = 'bee-agent-highlight'
const HIGHLIGHT_CONTAINER_ID = 'bee-agent-highlights-container'

interface HighlightStyle {
  backgroundColor: string
  borderColor: string
  textColor: string
  fontSize: string
  padding: string
  borderRadius: string
  zIndex: number
}

// 彩色方案 - 循环使用不同颜色
const COLOR_SCHEMES = [
  { bg: 'rgba(59, 130, 246, 0.25)', border: 'rgba(37, 99, 235, 0.9)', text: '#fff' }, // 蓝色
  { bg: 'rgba(16, 185, 129, 0.25)', border: 'rgba(5, 150, 105, 0.9)', text: '#fff' }, // 绿色
  { bg: 'rgba(245, 158, 11, 0.25)', border: 'rgba(217, 119, 6, 0.9)', text: '#fff' }, // 橙色
  { bg: 'rgba(239, 68, 68, 0.25)', border: 'rgba(220, 38, 38, 0.9)', text: '#fff' }, // 红色
  { bg: 'rgba(168, 85, 247, 0.25)', border: 'rgba(147, 51, 234, 0.9)', text: '#fff' }, // 紫色
  { bg: 'rgba(236, 72, 153, 0.25)', border: 'rgba(219, 39, 119, 0.9)', text: '#fff' }, // 粉色
  { bg: 'rgba(20, 184, 166, 0.25)', border: 'rgba(13, 148, 136, 0.9)', text: '#fff' }, // 青色
  { bg: 'rgba(251, 191, 36, 0.25)', border: 'rgba(245, 158, 11, 0.9)', text: '#000' }  // 黄色
]

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
 * 创建高亮遮罩容器
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
    `

    // 添加 CSS 动画
    const style = document.createElement('style')
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
    document.head.appendChild(style)
    document.body.appendChild(container)
  }

  return container
}

/**
 * 为元素添加高亮遮罩
 */
export function highlightElement(element: Element, index: number, style: Partial<HighlightStyle> = {}): void {
  const container = ensureHighlightContainer()
  const rect = element.getBoundingClientRect()

  // 创建遮罩层
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
    position: absolute;
    top: ${rect.top + window.scrollY}px;
    left: ${rect.left + window.scrollX}px;
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
 */
export function highlightElements(elements: Array<{ element: Element; index: number }>, style?: Partial<HighlightStyle>): void {
  clearHighlights()

  for (const { element, index } of elements) {
    highlightElement(element, index, style)
  }
}

/**
 * 清除所有高亮
 */
export function clearHighlights(): void {
  const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
  if (container) {
    container.innerHTML = ''
  }
}

/**
 * 移除高亮容器
 */
export function removeHighlightContainer(): void {
  const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
  if (container) {
    container.remove()
  }
}

/**
 * 高亮特定索引的元素
 */
export function highlightByIndex(index: number, style?: Partial<HighlightStyle>): void {
  const element = document.querySelector(`[data-bee-agent-index="${index}"]`)
  if (element) {
    highlightElement(element, index, style)
  }
}

/**
 * 更新高亮位置（滚动时调用）
 */
export function updateHighlightPositions(): void {
  const container = document.getElementById(HIGHLIGHT_CONTAINER_ID)
  if (!container) return

  const highlights = container.querySelectorAll(`.${HIGHLIGHT_CLASS}`)

  for (const highlight of highlights) {
    const index = (highlight as HTMLElement).dataset.index
    if (!index) continue

    const element = document.querySelector(`[data-bee-agent-index="${index}"]`)
    if (!element) continue

    const rect = element.getBoundingClientRect()
    const highlightEl = highlight as HTMLElement

    highlightEl.style.top = `${rect.top + window.scrollY}px`
    highlightEl.style.left = `${rect.left + window.scrollX}px`
    highlightEl.style.width = `${rect.width}px`
    highlightEl.style.height = `${rect.height}px`
  }
}

// 监听滚动事件，更新高亮位置
let scrollTimeout: number | null = null
window.addEventListener('scroll', () => {
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
  scrollTimeout = window.setTimeout(() => {
    updateHighlightPositions()
  }, 100) as unknown as number
}, { passive: true })

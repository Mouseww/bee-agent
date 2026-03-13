/**
 * BeeAgent UI
 * @module @bee-agent/ui
 * @description React 浮动界面组件，使用高优先级选择器实现样式隔离
 *
 * @example
 * ```ts
 * import { mountBeeAgentUI } from '@bee-agent/ui'
 * import { BeeAgent } from '@bee-agent/agent-core'
 *
 * const agent = new BeeAgent({ ... })
 * const unmount = mountBeeAgentUI(agent)
 *
 * // 卸载 UI
 * unmount()
 * ```
 */

import React from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import type { BeeAgent } from '@bee-agent/agent-core'
import { BeeAgentUI } from './BeeAgentUI'
import cssText from './styles.css?inline'

export { BeeAgentUI } from './BeeAgentUI'

/**
 * 注入 CSS 到页面 <head>（如果尚未注入）
 */
function injectStyles(): void {
  if (document.getElementById('bee-agent-styles')) return
  const style = document.createElement('style')
  style.id = 'bee-agent-styles'
  style.textContent = cssText
  document.head.appendChild(style)
}

/**
 * 挂载 BeeAgent UI 到页面
 * @description 使用独立容器 + bee-agent- 前缀 + all:initial 重置实现样式隔离
 * @param agent - BeeAgent 实例
 * @returns 卸载函数，调用后移除 UI
 */
export function mountBeeAgentUI(agent: BeeAgent): () => void {
  // 防止重复挂载
  const existing = document.getElementById('bee-agent-ui-root')
  if (existing) {
    existing.remove()
  }

  // 注入样式
  injectStyles()

  // 创建容器
  const container = document.createElement('div')
  container.id = 'bee-agent-ui-root'
  document.body.appendChild(container)

  // 渲染组件
  let root: Root | null = createRoot(container)

  const handleClose = () => {
    if (root) {
      root.unmount()
      root = null
    }
    container.remove()
  }

  root.render(
    <React.StrictMode>
      <BeeAgentUI agent={agent} onClose={handleClose} />
    </React.StrictMode>
  )

  // 返回卸载函数
  return handleClose
}

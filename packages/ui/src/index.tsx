/**
 * BeeAgent UI
 * @module @bee-agent/ui
 * @description React 浮动界面组件，提供 Agent 的可视化交互入口
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

export { BeeAgentUI } from './BeeAgentUI'

/**
 * 挂载 BeeAgent UI 到页面
 * @description 创建一个独立的 DOM 容器并渲染 BeeAgent 交互界面
 * @param agent - BeeAgent 实例
 * @returns 卸载函数，调用后移除 UI
 */
export function mountBeeAgentUI(agent: BeeAgent): () => void {
  // 防止重复挂载
  const existing = document.getElementById('bee-agent-ui-root')
  if (existing) {
    existing.remove()
  }

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

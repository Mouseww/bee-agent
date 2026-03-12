/**
 * BeeAgent UI
 * @module @bee-agent/ui
 * @description React 浮动界面组件，使用 Shadow DOM 实现样式隔离
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
 * 挂载 BeeAgent UI 到页面（Shadow DOM 隔离）
 * @description 创建 Shadow DOM 容器，完全隔离宿主页面样式，防止互相干扰
 * @param agent - BeeAgent 实例
 * @returns 卸载函数，调用后移除 UI
 */
export function mountBeeAgentUI(agent: BeeAgent): () => void {
  // 防止重复挂载
  const existing = document.getElementById('bee-agent-ui-root')
  if (existing) {
    existing.remove()
  }

  // 创建宿主容器
  const host = document.createElement('div')
  host.id = 'bee-agent-ui-root'
  // 确保宿主容器不受页面样式影响
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; top: 0; left: 0; width: 0; height: 0;'
  document.body.appendChild(host)

  // 创建 Shadow DOM
  const shadow = host.attachShadow({ mode: 'open' })

  // 注入样式到 Shadow DOM 内部
  const style = document.createElement('style')
  style.textContent = cssText
  shadow.appendChild(style)

  // 创建 React 挂载点
  const mountPoint = document.createElement('div')
  mountPoint.id = 'bee-agent-shadow-root'
  shadow.appendChild(mountPoint)

  // 渲染组件
  let root: Root | null = createRoot(mountPoint)

  const handleClose = () => {
    if (root) {
      root.unmount()
      root = null
    }
    host.remove()
  }

  root.render(
    <React.StrictMode>
      <BeeAgentUI agent={agent} onClose={handleClose} />
    </React.StrictMode>
  )

  // 返回卸载函数
  return handleClose
}

/**
 * BeeAgent UI
 * React 浮动界面组件
 */

import React from 'react'
import { createRoot } from 'react-dom/client'
import type { BeeAgent } from '@bee-agent/agent-core'
import { BeeAgentUI } from './BeeAgentUI'

export { BeeAgentUI } from './BeeAgentUI'

/**
 * 挂载 BeeAgent UI 到页面
 */
export function mountBeeAgentUI(agent: BeeAgent): () => void {
  // 创建容器
  const container = document.createElement('div')
  container.id = 'bee-agent-ui-root'
  document.body.appendChild(container)

  // 渲染组件
  const root = createRoot(container)

  const handleClose = () => {
    root.unmount()
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

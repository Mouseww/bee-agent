/**
 * BeeAgent Page Agent - IIFE 版本
 * 可通过 bookmarklet 或直接注入到页面
 */

import { BeeAgent } from '@bee-agent/agent-core'
import { mountBeeAgentUI } from '@bee-agent/ui'

// 全局命名空间
declare global {
  interface Window {
    BeeAgent?: typeof BeeAgent
    initBeeAgent?: (config: BeeAgentConfig) => void
    __beeAgentInstance?: BeeAgent
    __beeAgentUnmount?: () => void
  }
}

interface BeeAgentConfig {
  apiKey: string
  model?: string
  baseURL?: string
  language?: string
}

/**
 * 初始化 BeeAgent
 */
function initBeeAgent(config: BeeAgentConfig) {
  // 检查是否已经初始化
  if (window.__beeAgentInstance) {
    console.log('BeeAgent 已经运行中')
    return
  }

  try {
    // 验证配置
    if (!config.apiKey) {
      const apiKey = prompt('请输入 API Key:')
      if (!apiKey) {
        alert('需要 API Key 才能使用 BeeAgent')
        return
      }
      config.apiKey = apiKey
    }

    // 创建 Agent
    const agent = new BeeAgent({
      apiKey: config.apiKey,
      model: config.model || 'gpt-4',
      baseURL: config.baseURL || 'https://api.openai.com/v1'
    })

    // 挂载 UI
    const unmount = mountBeeAgentUI(agent)

    // 保存实例
    window.__beeAgentInstance = agent
    window.__beeAgentUnmount = unmount

    console.log('🐝 BeeAgent 已激活！按 Ctrl+Shift+B 可关闭')
  } catch (error) {
    console.error('BeeAgent 初始化失败:', error)
    alert('初始化失败: ' + (error as Error).message)
  }
}

// 快捷键支持
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'B') {
    e.preventDefault()
    if (window.__beeAgentInstance && window.__beeAgentUnmount) {
      window.__beeAgentUnmount()
      window.__beeAgentInstance = undefined
      window.__beeAgentUnmount = undefined
      console.log('BeeAgent 已关闭')
    } else {
      // 尝试从 localStorage 读取配置
      const savedConfig = localStorage.getItem('bee-agent-config')
      if (savedConfig) {
        initBeeAgent(JSON.parse(savedConfig))
      } else {
        initBeeAgent({ apiKey: '' })
      }
    }
  }
})

// 导出到全局
window.BeeAgent = BeeAgent
window.initBeeAgent = initBeeAgent

// 自动初始化（如果有保存的配置）
const savedConfig = localStorage.getItem('bee-agent-config')
if (savedConfig) {
  const config = JSON.parse(savedConfig)
  if (config.autoActivate) {
    initBeeAgent(config)
  }
}

export { initBeeAgent, BeeAgent }

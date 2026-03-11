/**
 * Content Script - 注入 BeeAgent 到页面
 */

import { BeeAgent } from '@bee-agent/agent-core'
import { DOMEngine } from '@bee-agent/dom-engine'
import { LLMClient } from '@bee-agent/llm-client'
import { mountBeeAgentUI } from '@bee-agent/ui'

let agent: BeeAgent | null = null
let unmountUI: (() => void) | null = null

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'activate') {
    activateBeeAgent()
    sendResponse({ success: true })
  }
  return true
})

// 监听快捷键 Ctrl+Shift+B
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'B') {
    e.preventDefault()
    if (agent && unmountUI) {
      unmountUI()
      agent = null
      unmountUI = null
    } else {
      activateBeeAgent()
    }
  }
})

async function activateBeeAgent() {
  if (agent) {
    console.log('BeeAgent 已经激活')
    return
  }

  try {
    // 从 storage 读取配置
    const config = await chrome.storage.sync.get(['apiKey', 'model', 'language'])

    if (!config.apiKey) {
      alert('请先在扩展设置中配置 API Key')
      return
    }

    // 初始化组件
    const domEngine = new DOMEngine()
    const llmClient = new LLMClient({
      apiKey: config.apiKey,
      model: config.model || 'gpt-4',
      baseURL: 'https://api.openai.com/v1'
    })

    // 创建 Agent
    agent = new BeeAgent({
      domEngine,
      llmClient,
      language: config.language || 'zh-CN'
    })

    // 挂载 UI
    unmountUI = mountBeeAgentUI(agent)

    console.log('BeeAgent 已激活')
  } catch (error) {
    console.error('激活 BeeAgent 失败:', error)
    alert('激活失败: ' + error.message)
  }
}

// 自动激活（如果之前已配置）
chrome.storage.sync.get(['autoActivate'], (result) => {
  if (result.autoActivate) {
    activateBeeAgent()
  }
})

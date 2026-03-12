/**
 * Content Script - 注入 BeeAgent 到页面
 * @module @bee-agent/extension
 * @description 在目标网页中创建 BeeAgent 实例并挂载 UI，支持快捷键和消息驱动激活
 */

import { BeeAgent } from '@bee-agent/agent-core'
import { mountBeeAgentUI } from '@bee-agent/ui'

let agent: BeeAgent | null = null
let unmountUI: (() => void) | null = null

/**
 * 清理 BeeAgent 实例和 UI
 * @description 释放 Agent 资源并卸载 UI 组件
 */
function cleanup(): void {
  if (agent) {
    agent.dispose()
    agent = null
  }
  if (unmountUI) {
    unmountUI()
    unmountUI = null
  }
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
      cleanup()
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
    const config = await chrome.storage.sync.get(['apiKey', 'baseURL', 'model', 'customModel', 'language'])

    if (!config.apiKey) {
      alert('请先在扩展设置中配置 API Key')
      return
    }

    const model = config.customModel || config.model || 'gpt-4'
    let baseURL = config.baseURL || 'https://api.openai.com/v1'
    // 确保 baseURL 以 /v1 结尾
    baseURL = baseURL.replace(/\/+$/, '')
    if (!baseURL.endsWith('/v1')) baseURL += '/v1'

    // 创建 Agent
    agent = new BeeAgent({
      apiKey: config.apiKey,
      model,
      baseURL
    })

    // 挂载 UI
    unmountUI = mountBeeAgentUI(agent)

    console.log('BeeAgent 已激活')
  } catch (error) {
    console.error('激活 BeeAgent 失败:', error)
    const message = error instanceof Error ? error.message : String(error)
    alert('激活失败: ' + message)
  }
}

// 自动注入检查
chrome.storage.sync.get(['autoInject', 'urlFilter', 'apiKey'], (result) => {
  if (result.autoInject && result.apiKey) {
    const currentURL = window.location.href
    const urlFilter = (result.urlFilter || '').trim()

    if (urlFilter) {
      // 有 URL 过滤规则，检查是否匹配
      const patterns = urlFilter.split('\n').map((p: string) => p.trim()).filter(Boolean)
      const matched = patterns.some((pattern: string) => urlMatchesPattern(currentURL, pattern))
      if (matched) {
        // 延迟注入，确保页面完全加载
        setTimeout(() => activateBeeAgent(), 1500)
      }
    } else {
      // 无过滤规则，所有页面自动注入
      setTimeout(() => activateBeeAgent(), 1500)
    }
  }
})

/**
 * URL 通配符匹配
 * 支持 * 通配符，例如 https://*.example.com/*
 */
function urlMatchesPattern(url: string, pattern: string): boolean {
  // 将通配符转换为正则
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // 转义特殊字符
    .replace(/\*/g, '.*')                     // * → .*
  try {
    return new RegExp('^' + escaped + '$', 'i').test(url)
  } catch {
    return false
  }
}

// 页面卸载时清理资源，防止内存泄漏
window.addEventListener('beforeunload', () => {
  cleanup()
})

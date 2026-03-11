/**
 * Background Service Worker
 */

// 扩展安装时
chrome.runtime.onInstalled.addListener(() => {
  console.log('BeeAgent Extension 已安装')
})

// 扩展图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
  // 发送消息到 content script 激活 BeeAgent
  try {
    await chrome.tabs.sendMessage(tab.id!, { action: 'activate' })
  } catch (error) {
    console.error('激活失败:', error)
  }
})

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.action === 'log') {
    console.log('[BeeAgent]', message.data)
  }
  return true
})

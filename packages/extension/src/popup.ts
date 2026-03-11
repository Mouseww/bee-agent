/**
 * Popup 脚本 - 配置界面
 */

// 加载保存的设置
chrome.storage.sync.get(['apiKey', 'model', 'language'], (result) => {
  if (result.apiKey) {
    document.getElementById('apiKey').value = result.apiKey
  }
  if (result.model) {
    document.getElementById('model').value = result.model
  }
  if (result.language) {
    document.getElementById('language').value = result.language
  }
})

// 保存设置
document.getElementById('saveBtn').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value
  const model = document.getElementById('model').value
  const language = document.getElementById('language').value

  if (!apiKey) {
    showStatus('请输入 API Key', 'error')
    return
  }

  chrome.storage.sync.set({ apiKey, model, language }, () => {
    showStatus('设置已保存！', 'success')
  })
})

// 激活 BeeAgent
document.getElementById('activateBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  chrome.tabs.sendMessage(tab.id, { action: 'activate' }, (response) => {
    if (chrome.runtime.lastError) {
      showStatus('激活失败，请刷新页面后重试', 'error')
    } else {
      showStatus('BeeAgent 已激活！', 'success')
      setTimeout(() => window.close(), 1000)
    }
  })
})

function showStatus(message, type) {
  const status = document.getElementById('status')
  status.textContent = message
  status.className = `status ${type}`
  status.style.display = 'block'

  setTimeout(() => {
    status.style.display = 'none'
  }, 3000)
}

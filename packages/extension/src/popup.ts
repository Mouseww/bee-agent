/**
 * Popup 脚本 - 配置界面
 */

// 加载保存的设置
chrome.storage.sync.get(['apiKey', 'model', 'language'], (result) => {
  if (result.apiKey) {
    const apiKeyEl = document.getElementById('apiKey') as HTMLInputElement | null
    if (apiKeyEl) apiKeyEl.value = result.apiKey
  }
  if (result.model) {
    const modelEl = document.getElementById('model') as HTMLInputElement | null
    if (modelEl) modelEl.value = result.model
  }
  if (result.language) {
    const languageEl = document.getElementById('language') as HTMLInputElement | null
    if (languageEl) languageEl.value = result.language
  }
})

// 保存设置
document.getElementById('saveBtn')?.addEventListener('click', () => {
  const apiKey = (document.getElementById('apiKey') as HTMLInputElement | null)?.value || ''
  const model = (document.getElementById('model') as HTMLInputElement | null)?.value || ''
  const language = (document.getElementById('language') as HTMLInputElement | null)?.value || ''

  if (!apiKey) {
    showStatus('请输入 API Key', 'error')
    return
  }

  chrome.storage.sync.set({ apiKey, model, language }, () => {
    showStatus('设置已保存！', 'success')
  })
})

// 激活 BeeAgent
document.getElementById('activateBtn')?.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'activate' }, () => {
      if (chrome.runtime.lastError) {
        showStatus('激活失败，请刷新页面后重试', 'error')
      } else {
        showStatus('BeeAgent 已激活！', 'success')
        setTimeout(() => window.close(), 1000)
      }
    })
  }
})

function showStatus(message: string, type: string): void {
  const status = document.getElementById('status')
  if (!status) return

  status.textContent = message
  status.className = `status ${type}`
  status.style.display = 'block'

  setTimeout(() => {
    if (status) status.style.display = 'none'
  }, 3000)
}

/**
 * Popup 脚本 - 配置界面
 * 支持自定义 Base URL + 动态获取模型列表
 */

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

// 加载保存的设置
chrome.storage.sync.get(['apiKey', 'baseURL', 'model', 'customModel', 'language', 'autoInject', 'urlFilter'], (result) => {
  const apiKeyEl = document.getElementById('apiKey') as HTMLInputElement | null
  const baseURLEl = document.getElementById('baseURL') as HTMLInputElement | null
  const modelEl = document.getElementById('model') as HTMLSelectElement | null
  const customModelEl = document.getElementById('customModel') as HTMLInputElement | null
  const languageEl = document.getElementById('language') as HTMLSelectElement | null
  const autoInjectEl = document.getElementById('autoInject') as HTMLInputElement | null
  const urlFilterEl = document.getElementById('urlFilter') as HTMLTextAreaElement | null
  const urlFilterGroup = document.getElementById('urlFilterGroup') as HTMLDivElement | null

  if (result.apiKey && apiKeyEl) apiKeyEl.value = result.apiKey
  if (result.baseURL && baseURLEl) baseURLEl.value = result.baseURL
  if (result.language && languageEl) languageEl.value = result.language
  if (result.customModel && customModelEl) customModelEl.value = result.customModel
  if (result.autoInject && autoInjectEl) {
    autoInjectEl.checked = true
    if (urlFilterGroup) urlFilterGroup.style.display = 'block'
  }
  if (result.urlFilter && urlFilterEl) urlFilterEl.value = result.urlFilter

  // 如果有保存的 baseURL 和 apiKey，自动拉取模型
  if (result.apiKey && result.baseURL) {
    fetchModels(result.baseURL, result.apiKey, result.model)
  } else if (result.model && modelEl) {
    // 没有拉取过，至少把保存的 model 设为自定义
    if (customModelEl) customModelEl.value = result.model
  }
})

/**
 * 从 /v1/models 拉取可用模型列表
 */
async function fetchModels(baseURL: string, apiKey: string, selectedModel?: string): Promise<void> {
  const modelEl = document.getElementById('model') as HTMLSelectElement | null
  const fetchBtn = document.getElementById('fetchModelsBtn') as HTMLButtonElement | null

  if (!modelEl) return

  if (fetchBtn) {
    fetchBtn.textContent = '获取中...'
    fetchBtn.disabled = true
  }

  // 清空现有选项
  modelEl.innerHTML = '<option value="">加载中...</option>'

  try {
    // 规范化 URL
    let url = baseURL.replace(/\/+$/, '')
    if (!url.endsWith('/v1')) url += '/v1'

    const response = await fetch(`${url}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const models: Array<{ id: string; owned_by?: string }> = data.data || []

    // 按名称排序
    models.sort((a, b) => a.id.localeCompare(b.id))

    // 填充下拉列表
    modelEl.innerHTML = ''

    if (models.length === 0) {
      modelEl.innerHTML = '<option value="">无可用模型</option>'
      showStatus('未找到可用模型', 'error')
      return
    }

    for (const model of models) {
      const option = document.createElement('option')
      option.value = model.id
      option.textContent = model.id + (model.owned_by ? ` (${model.owned_by})` : '')
      modelEl.appendChild(option)
    }

    // 选中之前保存的模型
    if (selectedModel) {
      modelEl.value = selectedModel
      // 如果保存的模型不在列表中，添加一个
      if (modelEl.value !== selectedModel) {
        const option = document.createElement('option')
        option.value = selectedModel
        option.textContent = `${selectedModel} (已保存)`
        modelEl.insertBefore(option, modelEl.firstChild)
        modelEl.value = selectedModel
      }
    }

    showStatus(`获取到 ${models.length} 个模型`, 'success')
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    modelEl.innerHTML = '<option value="">获取失败，请手动输入</option>'
    showStatus(`获取模型失败: ${msg}`, 'error')
  } finally {
    if (fetchBtn) {
      fetchBtn.textContent = '获取模型'
      fetchBtn.disabled = false
    }
  }
}

// 自动注入开关 → 显示/隐藏 URL 过滤
document.getElementById('autoInject')?.addEventListener('change', (e) => {
  const checked = (e.target as HTMLInputElement).checked
  const urlFilterGroup = document.getElementById('urlFilterGroup') as HTMLDivElement | null
  if (urlFilterGroup) {
    urlFilterGroup.style.display = checked ? 'block' : 'none'
  }
})

// 获取模型按钮
document.getElementById('fetchModelsBtn')?.addEventListener('click', () => {
  const apiKey = (document.getElementById('apiKey') as HTMLInputElement | null)?.value || ''
  const baseURL = (document.getElementById('baseURL') as HTMLInputElement | null)?.value || DEFAULT_BASE_URL

  if (!apiKey) {
    showStatus('请先输入 API Key', 'error')
    return
  }

  fetchModels(baseURL, apiKey)
})

// 保存设置
document.getElementById('saveBtn')?.addEventListener('click', () => {
  const apiKey = (document.getElementById('apiKey') as HTMLInputElement | null)?.value || ''
  const baseURL = (document.getElementById('baseURL') as HTMLInputElement | null)?.value || DEFAULT_BASE_URL
  const modelSelect = (document.getElementById('model') as HTMLSelectElement | null)?.value || ''
  const customModel = (document.getElementById('customModel') as HTMLInputElement | null)?.value || ''
  const language = (document.getElementById('language') as HTMLSelectElement | null)?.value || 'zh-CN'
  const autoInject = (document.getElementById('autoInject') as HTMLInputElement | null)?.checked || false
  const urlFilter = (document.getElementById('urlFilter') as HTMLTextAreaElement | null)?.value || ''

  // 优先使用自定义模型名，否则用下拉列表的
  const model = customModel || modelSelect

  if (!apiKey) {
    showStatus('请输入 API Key', 'error')
    return
  }

  if (!model) {
    showStatus('请选择或输入模型名称', 'error')
    return
  }

  chrome.storage.sync.set({ apiKey, baseURL, model, customModel, language, autoInject, urlFilter }, () => {
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

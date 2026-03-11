/**
 * BeeAgent UI 组件
 * @module @bee-agent/ui
 * @description 提供 Agent 的浮动交互界面，支持任务输入、步骤展示、设置管理
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { BeeAgent, AgentStatus, AgentStep } from '@bee-agent/agent-core'
import './styles.css'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

interface BeeAgentUIProps {
  agent: BeeAgent
  onClose?: () => void
}

interface Settings {
  apiKey: string
  baseURL: string
  model: string
  customModel: string
  language: string
}

interface ModelInfo {
  id: string
  owned_by?: string
}

/** 默认设置 */
const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  baseURL: '',
  model: '',
  customModel: '',
  language: 'zh-CN'
}

/**
 * 安全加载 localStorage 中的 JSON 数据
 * @param key - 存储键名
 * @param fallback - 解析失败时的默认值
 * @returns 解析后的对象或默认值
 */
function safeLoadJSON<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key)
    if (!saved) return fallback
    return JSON.parse(saved) as T
  } catch {
    return fallback
  }
}

/**
 * 安全的文本转义（防 XSS）
 * @param text - 原始文本
 * @returns 转义后的安全文本
 */
function escapeHTML(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * 简单的 Markdown 渲染（安全版本，先转义再替换）
 * @param text - 原始文本
 * @returns 安全的 HTML 字符串
 */
function renderMarkdown(text: string): string {
  const escaped = escapeHTML(text)
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>')
}

/**
 * 格式化时间戳为本地时间字符串
 * @param timestamp - Unix 毫秒时间戳
 * @returns 格式化的时间字符串
 */
function formatTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString()
  } catch {
    return '--:--:--'
  }
}

export function BeeAgentUI({ agent, onClose }: BeeAgentUIProps) {
  const [status, setStatus] = useState<AgentStatus>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('bee-agent-theme') === 'dark'
  })
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings>(() =>
    safeLoadJSON('bee-agent-settings', DEFAULT_SETTINGS)
  )
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  /** 添加消息（使用 useCallback 避免闭包问题） */
  const addMessage = useCallback((type: Message['type'], content: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        content,
        timestamp: Date.now()
      }
    ])
  }, [])

  // 监听 agent 事件
  useEffect(() => {
    const handleStatusChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setStatus(detail.status)
    }

    const handleStep = (e: Event) => {
      const detail = (e as CustomEvent).detail

      if (detail.type === 'observe') {
        addMessage('system', `步骤 ${detail.stepIndex + 1}: 观察页面状态...`)
      } else if (detail.type === 'think') {
        addMessage('system', `步骤 ${detail.stepIndex + 1}: 思考中...`)
      } else if (detail.type === 'act') {
        addMessage('system', `步骤 ${detail.stepIndex + 1}: 执行 ${detail.action}`)
      } else if (detail.type === 'error') {
        addMessage('system', `步骤 ${detail.stepIndex + 1}: 错误 - ${detail.error}`)
      } else if (detail.type === 'complete') {
        setSteps(prev => [...prev, detail.step])
      }
    }

    const handleError = (e: Event) => {
      const detail = (e as CustomEvent).detail
      addMessage('system', `错误: ${detail.error}`)
    }

    agent.addEventListener('statuschange', handleStatusChange)
    agent.addEventListener('step', handleStep)
    agent.addEventListener('error', handleError)

    return () => {
      agent.removeEventListener('statuschange', handleStatusChange)
      agent.removeEventListener('step', handleStep)
      agent.removeEventListener('error', handleError)
    }
  }, [agent, addMessage])

  // 主题切换
  useEffect(() => {
    localStorage.setItem('bee-agent-theme', isDarkMode ? 'dark' : 'light')
    if (containerRef.current) {
      containerRef.current.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
    }
  }, [isDarkMode])

  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault()
        if (onClose) onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // 拖拽功能
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      // 边界限制，防止拖出视口
      const maxX = window.innerWidth - 100
      const maxY = window.innerHeight - 50
      setPosition({
        x: Math.max(0, Math.min(e.clientX - dragOffset.x, maxX)),
        y: Math.max(0, Math.min(e.clientY - dragOffset.y, maxY))
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, steps])

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.bee-agent-header')) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        setIsDragging(true)
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        })
      }
    }
  }

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode)
  }

  const toggleSettings = () => {
    setShowSettings(!showSettings)
  }

  const saveSettings = () => {
    try {
      localStorage.setItem('bee-agent-settings', JSON.stringify(settings))
    } catch {
      addMessage('system', '保存设置失败')
    }
    setShowSettings(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || status === 'running') return

    const task = input.trim()
    setInput('')
    setSteps([])

    addMessage('user', task)
    addMessage('system', '开始执行任务...')

    try {
      const result = await agent.execute(task)

      if (result.success) {
        addMessage('assistant', `任务完成: ${result.message}`)
      } else {
        addMessage('assistant', `任务失败: ${result.message}`)
      }
    } catch (error) {
      addMessage('system', `错误: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleStop = () => {
    agent.stop()
    addMessage('system', '任务已停止')
  }

  const handleFetchModels = async () => {
    setIsFetchingModels(true)
    try {
      let url = (settings.baseURL || 'https://api.openai.com/v1').replace(/\/+$/, '')
      if (!url.endsWith('/v1')) url += '/v1'
      const res = await fetch(`${url}/models`, {
        headers: { 'Authorization': `Bearer ${settings.apiKey}` }
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      const data = await res.json()
      const models = (data.data || []).sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id))
      setAvailableModels(models)
      addMessage('system', `获取到 ${models.length} 个可用模型`)
    } catch (err) {
      addMessage('system', `获取模型失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsFetchingModels(false)
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'idle':
        return '空闲'
      case 'running':
        return '运行中'
      case 'completed':
        return '已完成'
      case 'error':
        return '错误'
      default:
        return '未知'
    }
  }

  return (
    <div
      ref={containerRef}
      className="bee-agent-container"
      data-theme={isDarkMode ? 'dark' : 'light'}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        height: isCollapsed ? 'auto' : '600px'
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="bee-agent-header">
        <div>
          <h3 className="bee-agent-title">BeeAgent</h3>
          <div className="bee-agent-status">
            {status === 'running' && <span className="bee-agent-loading" />}
            {' '}状态: {getStatusText()}
          </div>
        </div>
        <div className="bee-agent-header-actions">
          <button
            className="bee-agent-icon-button"
            onClick={toggleSettings}
            title="设置"
          >
            ⚙
          </button>
          <button
            className="bee-agent-icon-button"
            onClick={toggleTheme}
            title="切换主题"
          >
            {isDarkMode ? '☀' : '☽'}
          </button>
          <button
            className="bee-agent-icon-button"
            onClick={toggleCollapse}
            title={isCollapsed ? '展开' : '折叠'}
          >
            {isCollapsed ? '▲' : '▼'}
          </button>
          {onClose && (
            <button className="bee-agent-close" onClick={onClose} title="关闭 (Ctrl+Shift+B)">
              ×
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          {showSettings ? (
            <div className="bee-agent-settings">
              <h4>设置</h4>
              <div className="bee-agent-settings-item">
                <label>Base URL <small style={{opacity:0.6}}>(OpenAI 兼容)</small>:</label>
                <input
                  type="text"
                  value={settings.baseURL}
                  onChange={e => setSettings({ ...settings, baseURL: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div className="bee-agent-settings-item">
                <label>API Key:</label>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
                  placeholder="输入API Key"
                />
              </div>
              <div className="bee-agent-settings-item">
                <label>模型 <small style={{opacity:0.6}}>(从API获取)</small>:</label>
                <div style={{display:'flex',gap:'6px'}}>
                  <select
                    value={settings.model}
                    onChange={e => setSettings({ ...settings, model: e.target.value })}
                    style={{flex:1}}
                  >
                    <option value="">-- 点击获取 --</option>
                    {availableModels.map(m => (
                      <option key={m.id} value={m.id}>{m.id}{m.owned_by ? ` (${m.owned_by})` : ''}</option>
                    ))}
                  </select>
                  <button
                    className="bee-agent-button bee-agent-button-secondary"
                    style={{flexShrink:0,padding:'4px 8px',fontSize:'12px'}}
                    disabled={isFetchingModels || !settings.apiKey}
                    onClick={handleFetchModels}
                  >
                    {isFetchingModels ? '...' : '获取'}
                  </button>
                </div>
              </div>
              <div className="bee-agent-settings-item">
                <label>手动输入模型名 <small style={{opacity:0.6}}>(优先使用)</small>:</label>
                <input
                  type="text"
                  value={settings.customModel}
                  onChange={e => setSettings({ ...settings, customModel: e.target.value })}
                  placeholder="例如 qwen-plus, deepseek-chat"
                />
              </div>
              <div className="bee-agent-settings-item">
                <label>语言:</label>
                <select
                  value={settings.language}
                  onChange={e => setSettings({ ...settings, language: e.target.value })}
                >
                  <option value="zh-CN">中文</option>
                  <option value="en-US">English</option>
                </select>
              </div>
              <div className="bee-agent-settings-actions">
                <button className="bee-agent-button" onClick={saveSettings}>
                  保存
                </button>
                <button
                  className="bee-agent-button bee-agent-button-secondary"
                  onClick={toggleSettings}
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="bee-agent-messages">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`bee-agent-message bee-agent-message-${msg.type}`}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                ))}

                {steps.length > 0 && (
                  <div className="bee-agent-timeline">
                    <h4>执行步骤</h4>
                    {steps.map(step => (
                      <div key={step.index} className="bee-agent-step">
                        <div className="bee-agent-step-header">
                          <span className="bee-agent-step-index">步骤 {step.index + 1}</span>
                          <span className="bee-agent-step-time">
                            {formatTime(step.timestamp)}
                          </span>
                        </div>
                        <div className="bee-agent-step-thought">
                          {step.thought}
                        </div>
                        <div className="bee-agent-step-action">
                          ▶ {step.action.name}
                          <code>{JSON.stringify(step.action.input)}</code>
                        </div>
                        <div className="bee-agent-step-output">
                          ◀ {step.action.output}
                        </div>
                        {step.error && (
                          <div className="bee-agent-step-error">
                            ⚠ {step.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div className="bee-agent-input-container">
                <form onSubmit={handleSubmit} className="bee-agent-input-wrapper">
                  <input
                    type="text"
                    className="bee-agent-input"
                    placeholder="输入任务指令..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    disabled={status === 'running'}
                  />
                  {status === 'running' ? (
                    <button
                      type="button"
                      className="bee-agent-button bee-agent-button-stop"
                      onClick={handleStop}
                    >
                      停止
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="bee-agent-button"
                      disabled={!input.trim()}
                    >
                      发送
                    </button>
                  )}
                </form>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

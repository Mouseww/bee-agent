/**
 * BeeAgent UI 组件 - 全面重构版
 * @module @bee-agent/ui
 * @description 悬浮图标 + 侧边栏毛玻璃设计，支持拖拽、主题切换、设置管理
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { BeeAgent, AgentStatus, AgentStep } from '@bee-agent/agent-core'
import cssText from './styles.css?inline'

/**
 * 注入 CSS 样式到页面（如果尚未注入）
 * 用于 IIFE 模式下将样式内联到 JS 中
 */
function injectStyles(): void {
  if (document.getElementById('bee-agent-styles')) return
  const style = document.createElement('style')
  style.id = 'bee-agent-styles'
  style.textContent = cssText
  document.head.appendChild(style)
}

// 模块加载时立即注入样式
injectStyles()

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
 */
function escapeHTML(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * 简单的 Markdown 渲染（安全版本，先转义再替换）
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
 */
function formatTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString()
  } catch {
    return '--:--:--'
  }
}

export function BeeAgentUI({ agent, onClose }: BeeAgentUIProps) {
  // ── 状态 ──
  const [status, setStatus] = useState<AgentStatus>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
  const [isOpen, setIsOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('bee-agent-theme')
    return saved ? saved === 'dark' : true // 默认暗色
  })
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings>(() =>
    safeLoadJSON('bee-agent-settings', DEFAULT_SETTINGS)
  )
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [isFetchingModels, setIsFetchingModels] = useState(false)

  // ── 悬浮图标拖拽状态 ──
  const [fabPos, setFabPos] = useState({ x: window.innerWidth - 72, y: window.innerHeight - 72 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [wasDragged, setWasDragged] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // ── 添加消息 ──
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

  // ── 监听 agent 事件 ──
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

  // ── 主题切换持久化 ──
  useEffect(() => {
    localStorage.setItem('bee-agent-theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  // ── 快捷键 Ctrl+Shift+B ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault()
        if (isOpen) {
          setIsOpen(false)
        } else {
          setIsOpen(true)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // ── 悬浮图标拖拽 ──
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.x
      const dy = e.clientY - dragStart.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        setWasDragged(true)
      }
      const maxX = window.innerWidth - 52
      const maxY = window.innerHeight - 52
      setFabPos({
        x: Math.max(0, Math.min(e.clientX - 26, maxX)),
        y: Math.max(0, Math.min(e.clientY - 26, maxY))
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
  }, [isDragging, dragStart])

  // ── 自动滚动到底部 ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, steps])

  // ── 悬浮图标事件 ──
  const handleFabMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setWasDragged(false)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleFabClick = () => {
    if (!wasDragged) {
      setIsOpen(true)
    }
  }

  // ── 侧边栏关闭 ──
  const handleCloseSidebar = () => {
    setIsOpen(false)
    setShowSettings(false)
  }

  // ── 步骤折叠切换 ──
  const toggleStep = (index: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // ── 设置操作 ──
  const saveSettings = () => {
    try {
      localStorage.setItem('bee-agent-settings', JSON.stringify(settings))
    } catch {
      addMessage('system', '保存设置失败')
    }
    setShowSettings(false)
  }

  // ── 发送消息 ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || status === 'running') return

    const task = input.trim()
    setInput('')
    setSteps([])
    setExpandedSteps(new Set())

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

  // ── 获取模型列表 ──
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

  // ── 步骤图标 ──
  const getStepIcon = (step: AgentStep) => {
    if (step.error) return '⚠️'
    if (step.action?.output) return '⚡'
    if (step.thought) return '💭'
    return '👁️'
  }

  // ── 状态点颜色 ──
  const getStatusDotClass = () => {
    switch (status) {
      case 'running': return 'bee-status-dot bee-status-running'
      case 'error': return 'bee-status-dot bee-status-error'
      default: return 'bee-status-dot bee-status-idle'
    }
  }

  const theme = isDarkMode ? 'dark' : 'light'

  // ════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════
  return (
    <>
      {/* ── 悬浮图标 FAB ── */}
      {!isOpen && (
        <div
          className="bee-fab"
          style={{ left: `${fabPos.x}px`, top: `${fabPos.y}px` }}
          onMouseDown={handleFabMouseDown}
          onClick={handleFabClick}
          title="BeeAgent (Ctrl+Shift+B)"
        >
          🐝
        </div>
      )}

      {/* ── 侧边栏遮罩 ── */}
      {isOpen && (
        <div className="bee-overlay" onClick={handleCloseSidebar} />
      )}

      {/* ── 侧边栏 ── */}
      <div
        ref={sidebarRef}
        className={`bee-sidebar ${isOpen ? 'bee-sidebar-open' : ''}`}
        data-theme={theme}
      >
        {/* 顶栏 */}
        <div className="bee-topbar">
          <div className="bee-topbar-left">
            <span className="bee-topbar-logo">🐝</span>
            <span className="bee-topbar-title">BeeAgent</span>
            <span className={getStatusDotClass()} />
          </div>
          <div className="bee-topbar-right">
            <button
              className="bee-topbar-btn"
              onClick={() => setShowSettings(!showSettings)}
              title="设置"
            >
              ⚙️
            </button>
            <button
              className="bee-topbar-btn"
              onClick={() => setIsDarkMode(!isDarkMode)}
              title="切换主题"
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            <button
              className="bee-topbar-btn bee-topbar-close"
              onClick={handleCloseSidebar}
              title="关闭 (Ctrl+Shift+B)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 内容区 */}
        {showSettings ? (
          /* ── 设置面板 ── */
          <div className="bee-settings">
            <h4 className="bee-settings-title">⚙️ 设置</h4>

            <div className="bee-settings-group">
              <label className="bee-settings-label">Base URL <span className="bee-settings-hint">(OpenAI 兼容)</span></label>
              <input
                type="text"
                className="bee-settings-input"
                value={settings.baseURL}
                onChange={e => setSettings({ ...settings, baseURL: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <div className="bee-settings-group">
              <label className="bee-settings-label">API Key</label>
              <input
                type="password"
                className="bee-settings-input"
                value={settings.apiKey}
                onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>

            <div className="bee-settings-group">
              <label className="bee-settings-label">模型 <span className="bee-settings-hint">(从 API 获取)</span></label>
              <div className="bee-settings-row">
                <select
                  className="bee-settings-select"
                  value={settings.model}
                  onChange={e => setSettings({ ...settings, model: e.target.value })}
                >
                  <option value="">-- 选择模型 --</option>
                  {availableModels.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.id}{m.owned_by ? ` (${m.owned_by})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  className="bee-fetch-btn"
                  disabled={isFetchingModels || !settings.apiKey}
                  onClick={handleFetchModels}
                >
                  {isFetchingModels ? '...' : '获取'}
                </button>
              </div>
            </div>

            <div className="bee-settings-group">
              <label className="bee-settings-label">手动输入模型 <span className="bee-settings-hint">(优先使用)</span></label>
              <input
                type="text"
                className="bee-settings-input"
                value={settings.customModel}
                onChange={e => setSettings({ ...settings, customModel: e.target.value })}
                placeholder="例如 qwen-plus, deepseek-chat"
              />
            </div>

            <div className="bee-settings-group">
              <label className="bee-settings-label">语言</label>
              <select
                className="bee-settings-select"
                value={settings.language}
                onChange={e => setSettings({ ...settings, language: e.target.value })}
              >
                <option value="zh-CN">中文</option>
                <option value="en-US">English</option>
              </select>
            </div>

            <div className="bee-settings-actions">
              <button className="bee-btn-save" onClick={saveSettings}>
                保存
              </button>
              <button className="bee-btn-cancel" onClick={() => setShowSettings(false)}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── 消息区 ── */}
            <div className="bee-messages">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`bee-msg bee-msg-${msg.type}`}
                >
                  <div
                    className="bee-msg-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                  <div className="bee-msg-time">{formatTime(msg.timestamp)}</div>
                </div>
              ))}

              {/* 打字指示器 */}
              {status === 'running' && (
                <div className="bee-typing">
                  <span className="bee-typing-dot" />
                  <span className="bee-typing-dot" />
                  <span className="bee-typing-dot" />
                </div>
              )}

              {/* 步骤时间线 */}
              {steps.length > 0 && (
                <div className="bee-timeline">
                  {steps.map(step => (
                    <div key={step.index} className="bee-timeline-item">
                      <div className="bee-timeline-line" />
                      <div
                        className="bee-timeline-icon"
                        onClick={() => toggleStep(step.index)}
                      >
                        {getStepIcon(step)}
                      </div>
                      <div
                        className={`bee-timeline-card ${expandedSteps.has(step.index) ? 'bee-timeline-card-expanded' : ''}`}
                        onClick={() => toggleStep(step.index)}
                      >
                        <div className="bee-timeline-header">
                          <span className="bee-timeline-step-label">步骤 {step.index + 1}</span>
                          <span className="bee-timeline-step-time">{formatTime(step.timestamp)}</span>
                        </div>
                        {expandedSteps.has(step.index) && (
                          <div className="bee-timeline-body">
                            {step.thought && (
                              <div className="bee-timeline-thought">
                                💭 {step.thought}
                              </div>
                            )}
                            {step.action && (
                              <div className="bee-timeline-action">
                                ⚡ {step.action.name}
                                <code>{JSON.stringify(step.action.input)}</code>
                              </div>
                            )}
                            {step.action?.output && (
                              <div className="bee-timeline-output">
                                ◀ {step.action.output}
                              </div>
                            )}
                            {step.error && (
                              <div className="bee-timeline-error">
                                ⚠️ {step.error}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── 输入区 ── */}
            <div className="bee-input-area">
              <form onSubmit={handleSubmit} className="bee-input-form">
                <input
                  type="text"
                  className="bee-input"
                  placeholder="输入任务指令..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={status === 'running'}
                />
                {status === 'running' ? (
                  <button
                    type="button"
                    className="bee-send-btn bee-stop-btn"
                    onClick={handleStop}
                    title="停止"
                  >
                    ■
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="bee-send-btn"
                    disabled={!input.trim()}
                    title="发送"
                  >
                    →
                  </button>
                )}
              </form>
            </div>
          </>
        )}
      </div>
    </>
  )
}

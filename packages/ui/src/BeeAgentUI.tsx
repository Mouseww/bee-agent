/**
 * BeeAgent UI 组件 - 全面重构版
 * @module @bee-agent/ui
 * @description 悬浮图标 + 侧边栏毛玻璃设计，支持拖拽、主题切换、设置管理、Watch 监听模式
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { BeeAgent, AgentStatus, AgentStep, WatchEngine, WatchConfig } from '@bee-agent/agent-core'
import { WatchPanel } from './WatchPanel'

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

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system' | 'steps'
  content: string
  timestamp: number
  /** 步骤数据（仅 type='steps' 时有值） */
  steps?: AgentStep[]
}

/** 主 Tab 类型 */
type MainTab = 'chat' | 'watch'

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
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return ''
  }
}

interface BeeAgentUIProps {
  agent: BeeAgent
  onClose?: () => void
}

export function BeeAgentUI({ agent, onClose }: BeeAgentUIProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('bee-agent-theme')
    return saved !== 'light'
  })
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<AgentStatus>('idle')
  const [liveSteps, setLiveSteps] = useState<AgentStep[]>([])
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings>(() =>
    safeLoadJSON<Settings>('bee-agent-settings', DEFAULT_SETTINGS)
  )
  const [models, setModels] = useState<ModelInfo[]>([])
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [mainTab, setMainTab] = useState<MainTab>('chat')

  // 拖拽状态
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [wasDragged, setWasDragged] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── 添加消息 ──
  const addMessage = useCallback((type: Message['type'], content: string, extraSteps?: AgentStep[]) => {
    setMessages(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        content,
        timestamp: Date.now(),
        steps: extraSteps
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
        setLiveSteps(prev => [...prev, detail.step])
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

  // ── FAB 初始位置由 CSS right/bottom 控制，拖拽后切换为 left/top ──

  // ── 拖拽逻辑 ──
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const dx = Math.abs(e.clientX - dragStart.x)
      const dy = Math.abs(e.clientY - dragStart.y)
      if (dx > 5 || dy > 5) {
        setWasDragged(true)
      }
      setFabPos({ x: e.clientX - 24, y: e.clientY - 24 })
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
  }, [messages, liveSteps])

  // ── 悬浮图标事件 ──
  const handleFabMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setWasDragged(false)
    setDragStart({ x: e.clientX, y: e.clientY })
    // 如果还没被拖拽过，记录当前按钮位置
    if (!fabPos) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      setFabPos({ x: rect.left, y: rect.top })
    }
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
    setLiveSteps([])
    setExpandedSteps(new Set())

    addMessage('user', task)
    addMessage('system', '开始执行任务...')

    try {
      const result = await agent.execute(task)

      // 先插入步骤时间线，再插入最终结果
      const finalSteps = result.steps && result.steps.length > 0 ? result.steps : liveSteps
      if (finalSteps.length > 0) {
        addMessage('steps', `共 ${finalSteps.length} 个步骤`, [...finalSteps])
      }

      if (result.success) {
        addMessage('assistant', `任务完成: ${result.message}`)
      } else {
        addMessage('assistant', `任务失败: ${result.message}`)
      }

      // 清空实时步骤（已嵌入消息流）
      setLiveSteps([])
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
    const baseURL = settings.baseURL || settings.apiKey ? settings.baseURL : ''
    const apiKey = settings.apiKey

    if (!apiKey) {
      addMessage('system', '请先输入 API Key')
      return
    }
    if (!baseURL) {
      addMessage('system', '请先输入 Base URL')
      return
    }

    setIsFetchingModels(true)
    try {
      let url = baseURL.replace(/\/+$/, '')
      if (!url.endsWith('/v1')) url += '/v1'

      const response = await fetch(`${url}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      const modelList: ModelInfo[] = (data.data || []).sort((a: ModelInfo, b: ModelInfo) =>
        a.id.localeCompare(b.id)
      )
      setModels(modelList)
      addMessage('system', `获取到 ${modelList.length} 个模型`)
    } catch (error) {
      addMessage('system', `获取模型失败: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsFetchingModels(false)
    }
  }

  // ── 步骤图标 ──
  const getStepIcon = (step: AgentStep) => {
    if (step.error) return '❌'
    if (step.action?.name === 'done') return '✅'
    return '⚡'
  }

  // ── 渲染步骤时间线（共享组件） ──
  const renderTimeline = (stepsToRender: AgentStep[]) => (
    <div className="bee-timeline">
      {stepsToRender.map(step => (
        <div key={step.index} className="bee-timeline-item">
          <div className="bee-timeline-line" />
          <button
            className="bee-timeline-icon"
            onClick={() => toggleStep(step.index)}
          >
            {getStepIcon(step)}
          </button>
          <button
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
          </button>
        </div>
      ))}
    </div>
  )

  // ── 状态指示灯颜色 ──
  const statusColor = status === 'running' ? '#60a5fa' : status === 'error' ? '#f87171' : '#4ade80'
  const statusText = status === 'running' ? '运行中' : status === 'error' ? '错误' : '就绪'

  return (
    <div data-theme={isDarkMode ? 'dark' : 'light'}>
      {/* ── 悬浮图标 ── */}
      {!isOpen && (
        <button
          className="bee-fab"
          onMouseDown={handleFabMouseDown}
          onClick={handleFabClick}
          style={fabPos
            ? { left: `${fabPos.x}px`, top: `${fabPos.y}px` }
            : { right: '20px', bottom: '20px' }
          }
        >
          🐝
        </button>
      )}

      {/* ── 侧边栏 ── */}
      <div className={`bee-sidebar ${isOpen ? 'bee-sidebar-open' : ''}`}>
        {/* 顶栏 */}
        <div className="bee-topbar">
          <div className="bee-topbar-left">
            <span className="bee-topbar-logo">🐝</span>
            <span className="bee-topbar-title">BeeAgent</span>
            <span
              className="bee-status-dot"
              style={{ backgroundColor: statusColor }}
              title={statusText}
            />
          </div>
          <div className="bee-topbar-right">
            <button className="bee-topbar-btn" onClick={() => setShowSettings(!showSettings)} title="设置">
              ⚙️
            </button>
            <button className="bee-topbar-btn" onClick={() => setIsDarkMode(!isDarkMode)} title="主题">
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            <button className="bee-topbar-btn" onClick={handleCloseSidebar} title="关闭">
              ✕
            </button>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="bee-tabs">
          <button
            className={`bee-tab ${mainTab === 'chat' ? 'bee-tab-active' : ''}`}
            onClick={() => setMainTab('chat')}
          >
            💬 Chat
          </button>
          <button
            className={`bee-tab ${mainTab === 'watch' ? 'bee-tab-active' : ''}`}
            onClick={() => setMainTab('watch')}
          >
            👁️ Watch
          </button>
        </div>

        {/* 内容区 */}
        {showSettings ? (
          <div className="bee-settings">
            <h3 className="bee-settings-title">设置</h3>

            <div className="bee-settings-group">
              <label className="bee-settings-label">
                Base URL <span className="bee-settings-hint">(OpenAI 兼容)</span>
              </label>
              <input
                className="bee-settings-input"
                type="text"
                value={settings.baseURL}
                onChange={e => setSettings({ ...settings, baseURL: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <div className="bee-settings-group">
              <label className="bee-settings-label">API Key</label>
              <input
                className="bee-settings-input"
                type="password"
                value={settings.apiKey}
                onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>

            <div className="bee-settings-group">
              <label className="bee-settings-label">模型</label>
              <div className="bee-settings-row">
                <select
                  className="bee-settings-select"
                  value={settings.model}
                  onChange={e => setSettings({ ...settings, model: e.target.value })}
                >
                  <option value="">-- 选择模型 --</option>
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.id}</option>
                  ))}
                </select>
                <button
                  className="bee-btn-fetch"
                  onClick={handleFetchModels}
                  disabled={isFetchingModels}
                >
                  {isFetchingModels ? '...' : '获取'}
                </button>
              </div>
            </div>

            <div className="bee-settings-group">
              <label className="bee-settings-label">
                手动输入模型 <span className="bee-settings-hint">(优先使用)</span>
              </label>
              <input
                className="bee-settings-input"
                type="text"
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
        ) : mainTab === 'chat' ? (
          <>
            {/* ── 消息区 ── */}
            <div className="bee-messages">
              {messages.map(msg => {
                // 步骤消息：内联渲染时间线
                if (msg.type === 'steps' && msg.steps && msg.steps.length > 0) {
                  return <React.Fragment key={msg.id}>{renderTimeline(msg.steps)}</React.Fragment>
                }

                // 普通消息
                return (
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
                )
              })}

              {/* 打字指示器 */}
              {status === 'running' && (
                <div className="bee-typing">
                  <span className="bee-typing-dot" />
                  <span className="bee-typing-dot" />
                  <span className="bee-typing-dot" />
                </div>
              )}

              {/* 实时步骤（任务执行中，还未完成时） */}
              {status === 'running' && liveSteps.length > 0 && renderTimeline(liveSteps)}

              <div ref={messagesEndRef} />
            </div>

            {/* ── 输入区 ── */}
            <div className="bee-input-area">
              <form onSubmit={handleSubmit} className="bee-input-form">
                <input
                  className="bee-input"
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="输入任务..."
                  disabled={status === 'running'}
                />
                {status === 'running' ? (
                  <button type="button" className="bee-send-btn bee-stop-btn" onClick={handleStop}>
                    ■
                  </button>
                ) : (
                  <button type="submit" className="bee-send-btn" disabled={!input.trim()}>
                    →
                  </button>
                )}
              </form>
            </div>
          </>
        ) : (
          <WatchPanel agent={agent} />
        )}
      </div>
    </div>
  )
}

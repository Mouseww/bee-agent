/**
 * BeeAgent UI 组件
 */

import React, { useState, useEffect, useRef } from 'react'
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
  model: string
  language: string
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
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('bee-agent-settings')
    return saved ? JSON.parse(saved) : { apiKey: '', model: 'gpt-4', language: 'zh-CN' }
  })
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 监听agent事件
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
  }, [agent])

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
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, steps])

  const addMessage = (type: Message['type'], content: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        type,
        content,
        timestamp: Date.now()
      }
    ])
  }

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
    localStorage.setItem('bee-agent-settings', JSON.stringify(settings))
    setShowSettings(false)
  }

  // 简单的markdown渲染
  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>')
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
        addMessage('assistant', `✅ 任务完成: ${result.message}`)
      } else {
        addMessage('assistant', `❌ 任务失败: ${result.message}`)
      }
    } catch (error) {
      addMessage('system', `错误: ${error}`)
    }
  }

  const handleStop = () => {
    agent.stop()
    addMessage('system', '任务已停止')
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
          <h3 className="bee-agent-title">🐝 BeeAgent</h3>
          <div className="bee-agent-status">状态: {getStatusText()}</div>
        </div>
        <div className="bee-agent-header-actions">
          <button
            className="bee-agent-icon-button"
            onClick={toggleSettings}
            title="设置"
          >
            ⚙️
          </button>
          <button
            className="bee-agent-icon-button"
            onClick={toggleTheme}
            title="切换主题"
          >
            {isDarkMode ? '☀️' : '🌙'}
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
                <label>API Key:</label>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
                  placeholder="输入API Key"
                />
              </div>
              <div className="bee-agent-settings-item">
                <label>模型:</label>
                <select
                  value={settings.model}
                  onChange={e => setSettings({ ...settings, model: e.target.value })}
                >
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="claude-3-opus">Claude 3 Opus</option>
                  <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                </select>
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
                            {new Date().toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="bee-agent-step-thought">
                          💭 {step.thought}
                        </div>
                        <div className="bee-agent-step-action">
                          ▶️ {step.action.name}
                          <code>{JSON.stringify(step.action.input)}</code>
                        </div>
                        <div className="bee-agent-step-output">
                          ◀️ {step.action.output}
                        </div>
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

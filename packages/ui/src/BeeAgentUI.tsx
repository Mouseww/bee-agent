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

export function BeeAgentUI({ agent, onClose }: BeeAgentUIProps) {
  const [status, setStatus] = useState<AgentStatus>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [steps, setSteps] = useState<AgentStep[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 监听状态变化
    const handleStatusChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setStatus(detail.status)
    }

    // 监听步骤事件
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

    // 监听错误
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

  useEffect(() => {
    // 自动滚动到底部
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
    <div className="bee-agent-container">
      <div className="bee-agent-header">
        <div>
          <h3 className="bee-agent-title">🐝 BeeAgent</h3>
          <div className="bee-agent-status">状态: {getStatusText()}</div>
        </div>
        {onClose && (
          <button className="bee-agent-close" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      <div className="bee-agent-messages">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`bee-agent-message bee-agent-message-${msg.type}`}
          >
            {msg.content}
          </div>
        ))}

        {steps.map(step => (
          <div key={step.index} className="bee-agent-step">
            <div className="bee-agent-step-index">
              步骤 {step.index + 1}
            </div>
            <div>{step.thought}</div>
            <div className="bee-agent-step-action">
              → {step.action.name}({JSON.stringify(step.action.input)})
            </div>
            <div className="bee-agent-step-action">
              ← {step.action.output}
            </div>
          </div>
        ))}

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
    </div>
  )
}

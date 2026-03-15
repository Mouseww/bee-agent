/**
 * Watch 面板 UI 组件
 * @module @bee-agent/ui
 * @description 监听模式的完整 UI 面板，包含状态指示、规则列表、统计、日志和规则编辑器
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import type {
  WatchEngine,
  WatchRule,
  WatchStats,
  WatchLogEntry,
  WatchEngineStatus,
  WatchConfig
} from '@bee-agent/agent-core'
import { WATCH_PRESETS } from '@bee-agent/agent-core'

interface WatchPanelProps {
  watchEngine: WatchEngine | null
  watchConfig: WatchConfig | null
  onCreateEngine?: (config: WatchConfig) => WatchEngine
}

/** 格式化时间 */
function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString()
  } catch {
    return '--:--:--'
  }
}

/** 格式化持续时间 */
function formatDuration(ms: number): string {
  if (ms <= 0) return '0s'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

export function WatchPanel({ watchEngine, watchConfig, onCreateEngine }: WatchPanelProps) {
  // ── 状态 ──
  const [engine, setEngine] = useState<WatchEngine | null>(watchEngine)
  const [status, setStatus] = useState<WatchEngineStatus>('idle')
  const [rules, setRules] = useState<WatchRule[]>([])
  const [stats, setStats] = useState<WatchStats | null>(null)
  const [logs, setLogs] = useState<WatchLogEntry[]>([])
  const [activeTab, setActiveTab] = useState<'rules' | 'stats' | 'logs'>('rules')
  const [showPresets, setShowPresets] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [editingRule, setEditingRule] = useState<Partial<WatchRule> | null>(null)

  const logsEndRef = useRef<HTMLDivElement>(null)

  // ── 同步外部 engine ──
  useEffect(() => {
    setEngine(watchEngine)
  }, [watchEngine])

  // ── 监听引擎事件 ──
  useEffect(() => {
    if (!engine) return

    const handleStats = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setStats(detail.stats)
      setStatus(detail.stats.status)
    }

    const handleTrigger = () => {
      setRules(engine.getRules())
      setLogs(engine.getLogs())
    }

    const handleAction = () => {
      setLogs(engine.getLogs())
    }

    const handleError = () => {
      setLogs(engine.getLogs())
    }

    engine.addEventListener('stats', handleStats)
    engine.addEventListener('trigger', handleTrigger)
    engine.addEventListener('action', handleAction)
    engine.addEventListener('error', handleError)

    // 初始化状态
    setStatus(engine.getStatus())
    setRules(engine.getRules())
    setStats(engine.getStats())
    setLogs(engine.getLogs())

    return () => {
      engine.removeEventListener('stats', handleStats)
      engine.removeEventListener('trigger', handleTrigger)
      engine.removeEventListener('action', handleAction)
      engine.removeEventListener('error', handleError)
    }
  }, [engine])

  // ── 日志自动滚动 ──
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // ── 引擎控制 ──
  const handleStart = useCallback(() => {
    if (!engine && watchConfig && onCreateEngine) {
      const newEngine = onCreateEngine(watchConfig)
      setEngine(newEngine)
      newEngine.start()
    } else if (engine) {
      engine.start()
    }
  }, [engine, watchConfig, onCreateEngine])

  const handleStop = useCallback(() => {
    engine?.stop()
  }, [engine])

  const handlePause = useCallback(() => {
    engine?.pause()
  }, [engine])

  const handleResume = useCallback(() => {
    engine?.resume()
  }, [engine])

  // ── 规则操作 ──
  const handleAddPreset = useCallback((presetKey: string) => {
    if (!engine) return
    const preset = WATCH_PRESETS.find(p => p.key === presetKey)
    if (!preset) return

    const rule = preset.create()
    engine.addRule(rule)
    setRules(engine.getRules())
    setShowPresets(false)
  }, [engine])

  const handleToggleRule = useCallback((ruleId: string) => {
    if (!engine) return
    const rule = engine.getRules().find(r => r.id === ruleId)
    if (!rule) return
    engine.updateRule(ruleId, { enabled: !rule.enabled })
    setRules(engine.getRules())
  }, [engine])

  const handleDeleteRule = useCallback((ruleId: string) => {
    if (!engine) return
    engine.removeRule(ruleId)
    setRules(engine.getRules())
  }, [engine])

  const handleEditRule = useCallback((rule: WatchRule) => {
    setEditingRule({ ...rule })
    setShowEditor(true)
  }, [])

  const handleSaveRule = useCallback(() => {
    if (!engine || !editingRule) return

    if (editingRule.id) {
      engine.updateRule(editingRule.id, editingRule)
    }

    setRules(engine.getRules())
    setShowEditor(false)
    setEditingRule(null)
  }, [engine, editingRule])

  // ── 状态颜色 ──
  const getStatusColor = () => {
    switch (status) {
      case 'watching': return 'bee-watch-status-active'
      case 'paused': return 'bee-watch-status-paused'
      case 'error': return 'bee-watch-status-error'
      default: return 'bee-watch-status-idle'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'watching': return '监听中'
      case 'paused': return '已暂停'
      case 'error': return '错误'
      default: return '空闲'
    }
  }

  const getLogLevelClass = (level: WatchLogEntry['level']) => {
    switch (level) {
      case 'error': return 'bee-watch-log-error'
      case 'warn': return 'bee-watch-log-warn'
      case 'action': return 'bee-watch-log-action'
      default: return 'bee-watch-log-info'
    }
  }

  // ══════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════
  return (
    <div className="bee-watch-panel">
      {/* ── 状态栏 ── */}
      <div className="bee-watch-header">
        <div className="bee-watch-status-row">
          <span className={`bee-watch-status-dot ${getStatusColor()}`} />
          <span className="bee-watch-status-text">{getStatusText()}</span>
          {stats && stats.uptimeMs > 0 && (
            <span className="bee-watch-uptime">
              运行 {formatDuration(stats.uptimeMs)}
            </span>
          )}
        </div>
        <div className="bee-watch-controls">
          {status === 'idle' && (
            <button
              className="bee-watch-btn bee-watch-btn-start"
              onClick={handleStart}
              disabled={!watchConfig && !engine}
            >
              ▶ 启动
            </button>
          )}
          {status === 'watching' && (
            <>
              <button className="bee-watch-btn bee-watch-btn-pause" onClick={handlePause}>
                ⏸ 暂停
              </button>
              <button className="bee-watch-btn bee-watch-btn-stop" onClick={handleStop}>
                ⏹ 停止
              </button>
            </>
          )}
          {status === 'paused' && (
            <>
              <button className="bee-watch-btn bee-watch-btn-start" onClick={handleResume}>
                ▶ 恢复
              </button>
              <button className="bee-watch-btn bee-watch-btn-stop" onClick={handleStop}>
                ⏹ 停止
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── 子 Tab 切换 ── */}
      <div className="bee-watch-tabs">
        <button
          className={`bee-watch-tab ${activeTab === 'rules' ? 'bee-watch-tab-active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          📋 规则 ({rules.length})
        </button>
        <button
          className={`bee-watch-tab ${activeTab === 'stats' ? 'bee-watch-tab-active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 统计
        </button>
        <button
          className={`bee-watch-tab ${activeTab === 'logs' ? 'bee-watch-tab-active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          📝 日志 ({logs.length})
        </button>
      </div>

      {/* ── Tab 内容 ── */}
      <div className="bee-watch-content">
        {/* ──── 规则列表 ──── */}
        {activeTab === 'rules' && (
          <div className="bee-watch-rules">
            {rules.length === 0 ? (
              <div className="bee-watch-empty">
                <p>暂无监听规则</p>
                <p className="bee-watch-hint">点击下方按钮添加预设规则</p>
              </div>
            ) : (
              rules.map(rule => (
                <div key={rule.id} className={`bee-watch-rule-card ${!rule.enabled ? 'bee-watch-rule-disabled' : ''}`}>
                  <div className="bee-watch-rule-header">
                    <div className="bee-watch-rule-title">
                      <span className="bee-watch-rule-name">{rule.name}</span>
                      <span className="bee-watch-rule-type">{rule.trigger.type}</span>
                    </div>
                    <div className="bee-watch-rule-actions">
                      <button
                        className="bee-watch-rule-btn"
                        onClick={() => handleToggleRule(rule.id)}
                        title={rule.enabled ? '禁用' : '启用'}
                      >
                        {rule.enabled ? '✅' : '⬜'}
                      </button>
                      <button
                        className="bee-watch-rule-btn"
                        onClick={() => handleEditRule(rule)}
                        title="编辑"
                      >
                        ✏️
                      </button>
                      <button
                        className="bee-watch-rule-btn"
                        onClick={() => handleDeleteRule(rule.id)}
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className="bee-watch-rule-meta">
                    <span>触发 {rule.triggerCount} 次</span>
                    <span>冷却 {rule.cooldownSeconds}s</span>
                    {rule.lastTriggeredAt > 0 && (
                      <span>上次 {formatTime(rule.lastTriggeredAt)}</span>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* 添加规则按钮 */}
            <div className="bee-watch-add-area">
              <button
                className="bee-watch-btn bee-watch-btn-add"
                onClick={() => setShowPresets(!showPresets)}
              >
                + 添加预设规则
              </button>
            </div>

            {/* 预设选择 */}
            {showPresets && (
              <div className="bee-watch-presets">
                {WATCH_PRESETS.map(preset => (
                  <button
                    key={preset.key}
                    className="bee-watch-preset-item"
                    onClick={() => handleAddPreset(preset.key)}
                  >
                    <span className="bee-watch-preset-name">{preset.name}</span>
                    <span className="bee-watch-preset-desc">{preset.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ──── 统计信息 ──── */}
        {activeTab === 'stats' && (
          <div className="bee-watch-stats">
            {stats ? (
              <div className="bee-watch-stats-grid">
                <div className="bee-watch-stat-item">
                  <span className="bee-watch-stat-label">运行时长</span>
                  <span className="bee-watch-stat-value">{formatDuration(stats.uptimeMs)}</span>
                </div>
                <div className="bee-watch-stat-item">
                  <span className="bee-watch-stat-label">LLM 调用</span>
                  <span className="bee-watch-stat-value">{stats.llmCallCount} 次</span>
                </div>
                <div className="bee-watch-stat-item">
                  <span className="bee-watch-stat-label">Token 消耗</span>
                  <span className="bee-watch-stat-value">{stats.totalTokens.toLocaleString()}</span>
                </div>
                <div className="bee-watch-stat-item">
                  <span className="bee-watch-stat-label">预估费用</span>
                  <span className="bee-watch-stat-value">${stats.estimatedCostUSD.toFixed(4)}</span>
                </div>
                {Object.keys(stats.ruleTriggerCounts).length > 0 && (
                  <div className="bee-watch-stat-item bee-watch-stat-wide">
                    <span className="bee-watch-stat-label">规则触发次数</span>
                    <div className="bee-watch-stat-rules">
                      {Object.entries(stats.ruleTriggerCounts).map(([ruleId, count]) => {
                        const rule = rules.find(r => r.id === ruleId)
                        return (
                          <div key={ruleId} className="bee-watch-stat-rule-row">
                            <span>{rule?.name || ruleId.slice(0, 12)}</span>
                            <span>{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bee-watch-empty">
                <p>暂无统计数据</p>
                <p className="bee-watch-hint">启动监听后将显示统计信息</p>
              </div>
            )}
          </div>
        )}

        {/* ──── 日志 ──── */}
        {activeTab === 'logs' && (
          <div className="bee-watch-logs">
            {logs.length === 0 ? (
              <div className="bee-watch-empty">
                <p>暂无日志</p>
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`bee-watch-log-item ${getLogLevelClass(log.level)}`}>
                  <span className="bee-watch-log-time">{formatTime(log.timestamp)}</span>
                  <span className="bee-watch-log-level">[{log.level}]</span>
                  <span className="bee-watch-log-msg">{log.message}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* ── 规则编辑器弹窗 ── */}
      {showEditor && editingRule && (
        <div className="bee-watch-editor-overlay">
          <div className="bee-watch-editor">
            <h4 className="bee-watch-editor-title">编辑规则</h4>

            <div className="bee-watch-editor-group">
              <label className="bee-watch-editor-label">规则名称</label>
              <input
                type="text"
                className="bee-watch-editor-input"
                value={editingRule.name || ''}
                onChange={e => setEditingRule({ ...editingRule, name: e.target.value })}
              />
            </div>

            <div className="bee-watch-editor-group">
              <label className="bee-watch-editor-label">AI 指令</label>
              <textarea
                className="bee-watch-editor-textarea"
                value={editingRule.instruction || ''}
                onChange={e => setEditingRule({ ...editingRule, instruction: e.target.value })}
                rows={6}
              />
            </div>

            <div className="bee-watch-editor-group">
              <label className="bee-watch-editor-label">冷却时间（秒）</label>
              <input
                type="number"
                className="bee-watch-editor-input"
                value={editingRule.cooldownSeconds ?? 5}
                onChange={e => setEditingRule({ ...editingRule, cooldownSeconds: Number(e.target.value) })}
                min={0}
              />
            </div>

            <div className="bee-watch-editor-group">
              <label className="bee-watch-editor-label">
                活跃时段
                <span className="bee-watch-editor-hint">（可选，如 09:00-18:00）</span>
              </label>
              <input
                type="text"
                className="bee-watch-editor-input"
                value={editingRule.activeHours || ''}
                onChange={e => setEditingRule({ ...editingRule, activeHours: e.target.value || undefined })}
                placeholder="09:00-18:00"
              />
            </div>

            <div className="bee-watch-editor-actions">
              <button className="bee-watch-btn bee-watch-btn-save" onClick={handleSaveRule}>
                保存
              </button>
              <button
                className="bee-watch-btn bee-watch-btn-cancel"
                onClick={() => { setShowEditor(false); setEditingRule(null) }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

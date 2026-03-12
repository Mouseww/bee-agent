/**
 * Watch Mode 类型定义
 * @module @bee-agent/agent-core/watch
 * @description 监听模式的核心类型：配置、规则、触发器、事件
 */

// ── 触发器类型 ──

/** DOM 变化触发器 */
export interface DOMChangeTrigger {
  type: 'dom_change'
  /** 监控的 CSS 选择器 */
  selector: string
  /** 监听的变化类型 */
  attributes?: boolean
  childList?: boolean
  characterData?: boolean
  subtree?: boolean
}

/** 新消息触发器（聊天场景） */
export interface NewMessageTrigger {
  type: 'new_message'
  /** 消息容器的 CSS 选择器 */
  containerSelector: string
  /** 单条消息的 CSS 选择器 */
  messageSelector: string
  /** 排除自己发送的消息（CSS 选择器） */
  excludeSelector?: string
}

/** 定时检查触发器 */
export interface IntervalTrigger {
  type: 'interval'
  /** 检查间隔（秒） */
  intervalSeconds: number
  /** 监控的 CSS 选择器（用于快照对比） */
  selector?: string
}

/** 元素出现触发器 */
export interface ElementAppearTrigger {
  type: 'element_appear'
  /** 等待出现的元素 CSS 选择器 */
  selector: string
  /** 出现后是否持续监控（默认 false，只触发一次） */
  continuous?: boolean
}

/** 联合触发器类型 */
export type WatchTrigger =
  | DOMChangeTrigger
  | NewMessageTrigger
  | IntervalTrigger
  | ElementAppearTrigger

// ── 规则 ──

/** 监听规则定义 */
export interface WatchRule {
  /** 规则唯一 ID */
  id: string
  /** 规则名称 */
  name: string
  /** 是否启用 */
  enabled: boolean
  /** 触发器配置 */
  trigger: WatchTrigger
  /** AI 指令（系统提示词片段） */
  instruction: string
  /** 冷却时间（秒），两次触发之间的最小间隔 */
  cooldownSeconds: number
  /** 活跃时间窗口（24小时制，如 "09:00-18:00"） */
  activeHours?: string
  /** 累计触发次数 */
  triggerCount: number
  /** 上次触发时间戳 */
  lastTriggeredAt: number
}

// ── 事件载荷 ──

/** 页面变化记录 */
export interface PageChange {
  /** 变化类型 */
  type: 'dom_mutation' | 'new_message' | 'snapshot_diff' | 'element_appeared'
  /** 关联的规则 ID */
  ruleId: string
  /** 变化描述 */
  description: string
  /** 变化的 HTML 片段或文本 */
  content: string
  /** 时间戳 */
  timestamp: number
}

/** 新消息记录 */
export interface NewMessage {
  /** 发送者（从 DOM 提取） */
  sender: string
  /** 消息内容 */
  content: string
  /** 时间戳 */
  timestamp: number
  /** 原始 DOM 元素的外部 HTML */
  rawHTML: string
}

/** 交互记录（用于 SessionMemory） */
export interface InteractionRecord {
  /** 记录 ID */
  id: string
  /** 关联的规则 ID */
  ruleId: string
  /** 触发原因描述 */
  triggerReason: string
  /** 发送给 LLM 的 prompt 摘要 */
  promptSummary: string
  /** LLM 回复内容 */
  llmResponse: string
  /** 执行的工具操作 */
  actions: Array<{ tool: string; input: Record<string, unknown>; output: string }>
  /** 时间戳 */
  timestamp: number
  /** 使用的 token 数量 */
  tokenUsage: number
}

/** Watch 事件联合类型 */
export type WatchEvent =
  | { type: 'trigger'; rule: WatchRule; change: PageChange }
  | { type: 'action'; record: InteractionRecord }
  | { type: 'error'; ruleId: string; error: string }
  | { type: 'stats'; stats: WatchStats }

// ── 配置 & 状态 ──

/** WatchEngine 运行状态 */
export type WatchEngineStatus = 'idle' | 'watching' | 'paused' | 'error'

/** Watch 统计信息 */
export interface WatchStats {
  /** 引擎状态 */
  status: WatchEngineStatus
  /** 运行开始时间 */
  startedAt: number
  /** 运行时长（毫秒） */
  uptimeMs: number
  /** LLM 调用次数 */
  llmCallCount: number
  /** 总 token 使用量 */
  totalTokens: number
  /** 预估费用（美元） */
  estimatedCostUSD: number
  /** 各规则触发次数 */
  ruleTriggerCounts: Record<string, number>
}

/** Watch 日志条目 */
export interface WatchLogEntry {
  /** 时间戳 */
  timestamp: number
  /** 日志级别 */
  level: 'info' | 'warn' | 'error' | 'action'
  /** 关联的规则 ID */
  ruleId?: string
  /** 日志内容 */
  message: string
}

/** WatchEngine 配置 */
export interface WatchConfig {
  /** LLM API 基础 URL */
  baseURL: string
  /** LLM API 密钥 */
  apiKey: string
  /** LLM 模型名称 */
  model: string
  /** 温度参数 */
  temperature?: number
  /** 每分钟最大 LLM 调用次数 */
  maxCallsPerMinute?: number
  /** 每小时最大 LLM 调用次数 */
  maxCallsPerHour?: number
  /** SessionMemory 最大记录数 */
  maxMemoryRecords?: number
  /** 变化缓冲区最大条数 */
  maxChangeBuffer?: number
}

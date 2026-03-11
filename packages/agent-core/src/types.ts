/**
 * BeeAgent Core 类型定义
 * @module @bee-agent/agent-core
 * @description 定义 Agent 配置、状态、步骤、工具等核心类型
 */

/**
 * Agent 配置选项
 * @description 控制 Agent 的 LLM 连接、DOM 引擎和执行行为
 * @example
 * ```ts
 * const config: AgentConfig = {
 *   baseURL: 'https://api.openai.com/v1',
 *   apiKey: 'sk-xxx',
 *   model: 'gpt-4',
 *   maxSteps: 30,
 *   domConfig: { viewportExpansion: 200 }
 * }
 * ```
 */
export interface AgentConfig {
  /** API 基础 URL（OpenAI 兼容） */
  baseURL: string
  /** API 密钥 */
  apiKey: string
  /** 模型名称，如 'gpt-4', 'gpt-3.5-turbo' */
  model: string
  /** 温度参数，控制生成随机性，0-2，默认 0.7 */
  temperature?: number
  /** LLM 调用最大重试次数，默认 3 */
  maxRetries?: number
  /** 单次 LLM 调用超时时间（毫秒），默认 60000 */
  timeout?: number
  /** DOM 引擎配置 */
  domConfig?: {
    /** 视口扩展范围（像素），-1 为全页面模式 */
    viewportExpansion?: number
    /** 是否在文本输出中包含元素属性 */
    includeAttributes?: boolean
    /** 黑名单选择器列表 */
    blacklist?: string[]
  }
  /** 最大执行步骤数，防止无限循环，默认 20 */
  maxSteps?: number
  /** 自定义系统提示词（覆盖内置提示词） */
  systemPrompt?: string
  /** ask_user 工具的回调函数，返回用户回答 */
  onAskUser?: (question: string) => Promise<string>
}

/** Agent 运行状态 */
export type AgentStatus = 'idle' | 'running' | 'completed' | 'error'

/**
 * 工具调用参数的类型
 * @description 使用 Record<string, unknown> 替代 any 以增强类型安全
 */
export type ToolInput = Record<string, unknown>

/**
 * 单步执行记录
 * @description 记录 Agent 每一步的观察、思考、行动和反思
 */
export interface AgentStep {
  /** 步骤索引（从 0 开始） */
  index: number
  /** 观察结果：当前页面状态的文本表示 */
  observation: string
  /** 思考过程：LLM 的原始输出内容 */
  thought: string
  /** 执行的动作信息 */
  action: {
    /** 工具名称 */
    name: string
    /** 工具输入参数 */
    input: ToolInput
    /** 工具执行结果 */
    output: string
  }
  /** 步骤时间戳（Unix 毫秒） */
  timestamp: number
  /** 反思：对上一步执行结果的评估 */
  evaluation?: string
  /** 记忆：本步骤的重要信息摘要 */
  memory?: string
  /** 下一步目标：基于当前状态的下一步计划 */
  nextGoal?: string
  /** 步骤级别错误信息（如果发生了可恢复的错误） */
  error?: string
}

/**
 * 任务执行结果
 * @description Agent 完成整个任务后的最终返回值
 */
export interface ExecutionResult {
  /** 任务是否成功完成 */
  success: boolean
  /** 结果/错误消息 */
  message: string
  /** 所有执行步骤的记录 */
  steps: AgentStep[]
}

/**
 * Agent 工具定义
 * @description 定义一个可被 Agent 调用的工具（函数）
 */
export interface AgentTool {
  /** 工具唯一名称 */
  name: string
  /** 工具功能描述（供 LLM 理解） */
  description: string
  /** 工具参数的 JSON Schema 定义 */
  parameters: Record<string, unknown>
  /** 工具执行函数 */
  execute: (input: ToolInput) => Promise<string>
}

/**
 * Agent 记忆管理
 * @description FIFO 队列式记忆，保持最近 N 条记忆
 */
export interface AgentMemory {
  /** 累积的记忆内容列表 */
  content: string[]
  /** 最大记忆条数 */
  maxItems: number
}

/**
 * 反思结果
 * @description 从 LLM 输出中解析出的结构化反思信息
 */
export interface ReflectionResult {
  /** 对上一步执行结果的评估 */
  evaluation: string
  /** 本步骤的记忆摘要 */
  memory: string
  /** 下一步目标 */
  nextGoal: string
}

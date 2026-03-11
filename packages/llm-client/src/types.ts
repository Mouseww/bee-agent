/**
 * BeeAgent LLM 客户端类型定义
 * @module @bee-agent/llm-client
 * @description OpenAI 兼容 API 的类型系统定义，支持多种 LLM 提供商
 */

/**
 * LLM 客户端配置选项
 * @example
 * ```ts
 * const config: LLMConfig = {
 *   baseURL: 'https://api.openai.com/v1',
 *   apiKey: 'sk-xxx',
 *   model: 'gpt-4',
 *   temperature: 0.7,
 *   maxRetries: 3,
 *   timeout: 60000
 * }
 * ```
 */
export interface LLMConfig {
  /** API 基础 URL（不含尾部斜杠） */
  baseURL: string
  /** API 密钥 */
  apiKey: string
  /** 模型名称，如 'gpt-4', 'claude-3-sonnet' 等 */
  model: string
  /** 温度参数 (0-2)，越低越确定性 */
  temperature?: number
  /** 最大重试次数 (1-10)，默认 3 */
  maxRetries?: number
  /** 请求超时时间（毫秒），默认 60000 */
  timeout?: number
  /** 最大 token 数限制 */
  maxTokens?: number
}

/**
 * 聊天消息结构
 * @description 支持 system/user/assistant/tool 四种角色
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  /** 工具调用列表（assistant 消息中使用） */
  tool_calls?: ToolCall[]
  /** 工具调用 ID（tool 消息中使用） */
  tool_call_id?: string
}

/**
 * 工具（函数调用）定义
 * @description 符合 OpenAI Tool 格式规范
 */
export interface Tool {
  type: 'function'
  function: {
    /** 工具名称，仅允许字母、数字和下划线 */
    name: string
    /** 工具功能描述 */
    description: string
    /** JSON Schema 格式的参数定义 */
    parameters: Record<string, unknown>
  }
}

/**
 * 工具调用结构
 * @description LLM 返回的工具调用信息
 */
export interface ToolCall {
  /** 工具调用唯一标识 */
  id: string
  type: 'function'
  function: {
    /** 被调用的工具名称 */
    name: string
    /** JSON 格式的调用参数 */
    arguments: string
  }
}

/**
 * Chat Completion API 完整响应
 * @description 符合 OpenAI Chat Completion 响应格式
 */
export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string | null
      tool_calls?: ToolCall[]
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * 流式响应块
 * @description SSE 数据流中的单个事件数据
 */
export interface StreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string
      tool_calls?: Array<{
        index: number
        id?: string
        type?: string
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
    finish_reason: string | null
  }>
}

/**
 * LLM 调用结果（归一化后的响应）
 * @description 将原始 API 响应归一化为统一格式
 */
export interface InvokeResult {
  /** 文本内容响应 */
  content: string | null
  /** 工具调用列表 */
  toolCalls: ToolCall[]
  /** Token 使用统计 */
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  /** 原始 API 响应 */
  rawResponse: ChatCompletionResponse
}

/**
 * LLM 客户端事件映射
 * @description 定义客户端可派发的自定义事件类型
 */
export interface LLMClientEventMap {
  /** 重试事件 */
  retry: CustomEvent<{ attempt: number; maxAttempts: number; error: Error }>
  /** 错误事件 */
  error: CustomEvent<{ error: Error }>
}

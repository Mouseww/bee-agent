/**
 * LLM 客户端类型定义
 */

export interface LLMConfig {
  /** API 基础 URL */
  baseURL: string
  /** API 密钥 */
  apiKey: string
  /** 模型名称 */
  model: string
  /** 温度参数 */
  temperature?: number
  /** 最大重试次数 */
  maxRetries?: number
  /** 超时时间（毫秒） */
  timeout?: number
}

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface Tool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, any>
  }
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

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
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

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

export interface InvokeResult {
  content: string | null
  toolCalls: ToolCall[]
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  rawResponse: ChatCompletionResponse
}

/**
 * Agent Core 类型定义
 */

export interface AgentConfig {
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
  /** DOM 引擎配置 */
  domConfig?: {
    viewportExpansion?: number
    includeAttributes?: boolean
    blacklist?: string[]
  }
  /** 最大步骤数 */
  maxSteps?: number
  /** 系统提示词 */
  systemPrompt?: string
}

export type AgentStatus = 'idle' | 'running' | 'completed' | 'error'

export interface AgentStep {
  /** 步骤索引 */
  index: number
  /** 观察结果 */
  observation: string
  /** 思考过程 */
  thought: string
  /** 执行的动作 */
  action: {
    name: string
    input: any
    output: string
  }
  /** 时间戳 */
  timestamp: number
}

export interface ExecutionResult {
  success: boolean
  message: string
  steps: AgentStep[]
}

export interface AgentTool {
  name: string
  description: string
  parameters: Record<string, any>
  execute: (input: any) => Promise<string>
}

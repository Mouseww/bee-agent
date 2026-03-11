/**
 * OpenAI 兼容 LLM 客户端
 * @module @bee-agent/llm-client
 * @description 支持 OpenAI、Azure、Claude 等兼容 API 的统一客户端
 *
 * 特性：
 * - 自动重试（指数退避 + 抖动）
 * - 流式和非流式调用
 * - 超时控制
 * - 请求中止
 * - 错误分类与处理
 */

import type {
  LLMConfig,
  Message,
  Tool,
  ChatCompletionResponse,
  StreamChunk,
  InvokeResult
} from './types'

/** 可重试的 HTTP 状态码 */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

/** 不可重试的 HTTP 状态码（客户端错误） */
const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404])

/**
 * LLM API 调用错误
 * @description 封装 HTTP 状态码和响应详情的专用错误类
 */
export class LLMApiError extends Error {
  constructor(
    message: string,
    /** HTTP 状态码 */
    public readonly statusCode: number,
    /** 原始响应文本 */
    public readonly responseBody?: string,
    /** 是否可重试 */
    public readonly retryable: boolean = false
  ) {
    super(message)
    this.name = 'LLMApiError'
  }
}

/**
 * OpenAI 兼容 LLM 客户端
 *
 * @example
 * ```ts
 * const client = new LLMClient({
 *   baseURL: 'https://api.openai.com/v1',
 *   apiKey: 'sk-xxx',
 *   model: 'gpt-4'
 * })
 *
 * const result = await client.invoke([
 *   { role: 'user', content: 'Hello!' }
 * ])
 * console.log(result.content)
 * ```
 */
export class LLMClient extends EventTarget {
  private config: Required<Omit<LLMConfig, 'maxTokens'>> & Pick<LLMConfig, 'maxTokens'>
  private _disposed = false

  constructor(config: LLMConfig) {
    super()

    // 参数验证
    if (!config.baseURL) throw new Error('LLMClient: baseURL is required')
    if (!config.apiKey) throw new Error('LLMClient: apiKey is required')
    if (!config.model) throw new Error('LLMClient: model is required')

    this.config = {
      temperature: 0.7,
      maxRetries: 3,
      timeout: 60000,
      ...config
    }

    // 边界值校验
    if (this.config.maxRetries < 1) this.config.maxRetries = 1
    if (this.config.maxRetries > 10) this.config.maxRetries = 10
    if (this.config.timeout < 5000) this.config.timeout = 5000
    if (this.config.temperature < 0) this.config.temperature = 0
    if (this.config.temperature > 2) this.config.temperature = 2
  }

  /**
   * 调用 LLM（非流式）
   * @param messages - 消息列表
   * @param tools - 可选的工具定义列表
   * @param signal - 可选的中止信号
   * @returns 归一化的调用结果
   * @throws {LLMApiError} API 调用失败时抛出
   */
  async invoke(
    messages: Message[],
    tools?: Tool[],
    signal?: AbortSignal
  ): Promise<InvokeResult> {
    this.ensureNotDisposed()

    if (!messages || messages.length === 0) {
      throw new Error('LLMClient: messages array cannot be empty')
    }

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // 检查是否已中止
        if (signal?.aborted) {
          throw new Error('Request aborted')
        }

        if (attempt > 1) {
          const delayMs = this.getRetryDelay(attempt)
          this.dispatchEvent(
            new CustomEvent('retry', {
              detail: { attempt, maxAttempts: this.config.maxRetries, error: lastError }
            })
          )
          await this.delay(delayMs, signal)
        }

        const response = await this.makeRequest(messages, tools, false, signal)
        const data = await response.json() as ChatCompletionResponse

        // 验证响应结构
        if (!data.choices || data.choices.length === 0) {
          throw new Error('Invalid API response: no choices returned')
        }

        const choice = data.choices[0]
        const message = choice.message

        if (!message) {
          throw new Error('Invalid API response: no message in choice')
        }

        return {
          content: message.content,
          toolCalls: message.tool_calls || [],
          usage: {
            promptTokens: data.usage?.prompt_tokens ?? 0,
            completionTokens: data.usage?.completion_tokens ?? 0,
            totalTokens: data.usage?.total_tokens ?? 0
          },
          rawResponse: data
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // 不可重试的错误直接抛出
        if (signal?.aborted) {
          throw new Error('Request aborted')
        }

        if (error instanceof LLMApiError && !error.retryable) {
          this.dispatchEvent(
            new CustomEvent('error', { detail: { error: lastError } })
          )
          throw error
        }

        if (attempt === this.config.maxRetries) {
          this.dispatchEvent(
            new CustomEvent('error', { detail: { error: lastError } })
          )
          throw lastError
        }
      }
    }

    throw lastError || new Error('LLMClient: unknown error')
  }

  /**
   * 调用 LLM（流式）
   * @param messages - 消息列表
   * @param tools - 可选的工具定义列表
   * @param signal - 可选的中止信号
   * @yields StreamChunk 流式响应块
   */
  async *invokeStream(
    messages: Message[],
    tools?: Tool[],
    signal?: AbortSignal
  ): AsyncGenerator<StreamChunk> {
    this.ensureNotDisposed()

    if (!messages || messages.length === 0) {
      throw new Error('LLMClient: messages array cannot be empty')
    }

    const response = await this.makeRequest(messages, tools, true, signal)

    if (!response.body) {
      throw new Error('No response body for streaming')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        if (signal?.aborted) {
          break
        }

        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue

          if (trimmed.startsWith('data: ')) {
            try {
              const json = trimmed.slice(6)
              const chunk = JSON.parse(json) as StreamChunk
              yield chunk
            } catch {
              // 忽略无法解析的 SSE 块，继续处理后续数据
              console.warn('[BeeAgent] Failed to parse SSE chunk:', trimmed)
            }
          }
        }
      }

      // 处理缓冲区中剩余的数据
      if (buffer.trim()) {
        const trimmed = buffer.trim()
        if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
          try {
            const json = trimmed.slice(6)
            const chunk = JSON.parse(json) as StreamChunk
            yield chunk
          } catch {
            // 忽略最后一个不完整的块
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * 更新配置（动态修改模型、温度等）
   * @param partial - 要更新的配置项
   */
  updateConfig(partial: Partial<LLMConfig>): void {
    Object.assign(this.config, partial)
  }

  /**
   * 销毁客户端，释放资源
   */
  dispose(): void {
    this._disposed = true
  }

  /**
   * 发起 HTTP 请求
   */
  private async makeRequest(
    messages: Message[],
    tools?: Tool[],
    stream = false,
    signal?: AbortSignal
  ): Promise<Response> {
    // 清理 baseURL 尾部斜杠
    const baseURL = this.config.baseURL.replace(/\/+$/, '')
    const url = `${baseURL}/chat/completions`

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      stream
    }

    if (this.config.maxTokens) {
      body.max_tokens = this.config.maxTokens
    }

    if (tools && tools.length > 0) {
      body.tools = tools
      body.tool_choice = 'auto'
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    // 链接外部中止信号
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeoutId)
        controller.abort()
        throw new Error('Request aborted')
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      if (!response.ok) {
        let errorText = ''
        try {
          errorText = await response.text()
        } catch {
          errorText = 'Unable to read error response'
        }

        const retryable = RETRYABLE_STATUS_CODES.has(response.status)
        const isClientError = NON_RETRYABLE_STATUS_CODES.has(response.status)

        throw new LLMApiError(
          `HTTP ${response.status}: ${errorText}`,
          response.status,
          errorText,
          retryable && !isClientError
        )
      }

      return response
    } catch (error) {
      if (error instanceof LLMApiError) throw error

      // 网络错误等（可重试）
      if (error instanceof TypeError || (error as Error).name === 'AbortError') {
        if (signal?.aborted) {
          throw new Error('Request aborted')
        }
        throw error
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * 计算重试延迟（指数退避 + 抖动）
   */
  private getRetryDelay(attempt: number): number {
    const baseDelay = Math.pow(2, attempt - 1) * 1000
    const jitter = Math.random() * 500
    return Math.min(baseDelay + jitter, 30000)
  }

  /**
   * 可中止的延迟函数
   */
  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Request aborted'))
        return
      }

      const timer = setTimeout(resolve, ms)

      signal?.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new Error('Request aborted'))
      }, { once: true })
    })
  }

  /**
   * 确保客户端未被销毁
   */
  private ensureNotDisposed(): void {
    if (this._disposed) {
      throw new Error('LLMClient has been disposed')
    }
  }
}

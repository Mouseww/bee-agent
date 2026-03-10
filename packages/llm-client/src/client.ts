/**
 * OpenAI 兼容 LLM 客户端
 */

import type {
  LLMConfig,
  Message,
  Tool,
  ChatCompletionResponse,
  StreamChunk,
  InvokeResult
} from './types'

export class LLMClient extends EventTarget {
  private config: Required<LLMConfig>

  constructor(config: LLMConfig) {
    super()
    this.config = {
      temperature: 0.7,
      maxRetries: 3,
      timeout: 60000,
      ...config
    }
  }

  /**
   * 调用 LLM（非流式）
   */
  async invoke(
    messages: Message[],
    tools?: Tool[],
    signal?: AbortSignal
  ): Promise<InvokeResult> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          this.dispatchEvent(
            new CustomEvent('retry', {
              detail: { attempt, maxAttempts: this.config.maxRetries }
            })
          )
          await this.delay(Math.pow(2, attempt - 1) * 1000)
        }

        const response = await this.makeRequest(messages, tools, false, signal)
        const data = await response.json() as ChatCompletionResponse

        const choice = data.choices[0]
        const message = choice.message

        return {
          content: message.content,
          toolCalls: message.tool_calls || [],
          usage: {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens
          },
          rawResponse: data
        }
      } catch (error) {
        lastError = error as Error

        if (signal?.aborted) {
          throw new Error('Request aborted')
        }

        if (attempt === this.config.maxRetries) {
          this.dispatchEvent(
            new CustomEvent('error', { detail: { error: lastError } })
          )
          throw lastError
        }
      }
    }

    throw lastError || new Error('Unknown error')
  }

  /**
   * 调用 LLM（流式）
   */
  async *invokeStream(
    messages: Message[],
    tools?: Tool[],
    signal?: AbortSignal
  ): AsyncGenerator<StreamChunk> {
    const response = await this.makeRequest(messages, tools, true, signal)

    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
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
            } catch (e) {
              console.warn('Failed to parse SSE chunk:', e)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
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
    const url = `${this.config.baseURL}/chat/completions`

    const body: any = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      stream
    }

    if (tools && tools.length > 0) {
      body.tools = tools
      body.tool_choice = 'auto'
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    if (signal) {
      signal.addEventListener('abort', () => controller.abort())
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
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

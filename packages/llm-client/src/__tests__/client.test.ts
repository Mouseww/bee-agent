/**
 * LLMClient 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LLMClient } from '../client'
import type { Message, ChatCompletionResponse } from '../types'

describe('LLMClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('构造函数', () => {
    it('应该使用默认配置', () => {
      const client = new LLMClient({
        baseURL: 'https://api.example.com',
        apiKey: 'test-key',
        model: 'gpt-4'
      })

      expect(client).toBeInstanceOf(LLMClient)
    })

    it('应该合并自定义配置', () => {
      const client = new LLMClient({
        baseURL: 'https://api.example.com',
        apiKey: 'test-key',
        model: 'gpt-4',
        temperature: 0.5,
        maxRetries: 5,
        timeout: 30000
      })

      expect(client).toBeInstanceOf(LLMClient)
    })
  })

  describe('invoke 方法', () => {
    it('应该成功调用 LLM 并返回结果', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello, world!'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const client = new LLMClient({
        baseURL: 'https://api.example.com',
        apiKey: 'test-key',
        model: 'gpt-4'
      })

      const messages: Message[] = [
        { role: 'user', content: 'Hello' }
      ]

      const result = await client.invoke(messages)

      expect(result.content).toBe('Hello, world!')
      expect(result.toolCalls).toEqual([])
      expect(result.usage.totalTokens).toBe(15)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('应该正确格式化请求', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const client = new LLMClient({
        baseURL: 'https://api.example.com',
        apiKey: 'test-key',
        model: 'gpt-4',
        temperature: 0.8
      })

      const messages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' }
      ]

      await client.invoke(messages)

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          },
          body: expect.stringContaining('"model":"gpt-4"')
        })
      )

      const callArgs = fetchMock.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.temperature).toBe(0.8)
      expect(body.messages).toEqual(messages)
      expect(body.stream).toBe(false)
    })

    it('应该支持工具调用', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call-1',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location":"Beijing"}'
                  }
                }
              ]
            },
            finish_reason: 'tool_calls'
          }
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 10,
          total_tokens: 30
        }
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const client = new LLMClient({
        baseURL: 'https://api.example.com',
        apiKey: 'test-key',
        model: 'gpt-4'
      })

      const messages: Message[] = [
        { role: 'user', content: 'What is the weather in Beijing?' }
      ]

      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'get_weather',
            description: 'Get weather information',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' }
              }
            }
          }
        }
      ]

      const result = await client.invoke(messages, tools)

      expect(result.content).toBeNull()
      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls[0].function.name).toBe('get_weather')
    })

    it('应该在失败时重试', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Success'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      }

      // 前两次失败，第三次成功
      fetchMock
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        })

      const client = new LLMClient({
        baseURL: 'https://api.example.com',
        apiKey: 'test-key',
        model: 'gpt-4',
        maxRetries: 3
      })

      const messages: Message[] = [
        { role: 'user', content: 'Hello' }
      ]

      const result = await client.invoke(messages)

      expect(result.content).toBe('Success')
      expect(fetchMock).toHaveBeenCalledTimes(3)
    }, 10000)

    it('应该在达到最大重试次数后抛出错误', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'))

      const client = new LLMClient({
        baseURL: 'https://api.example.com',
        apiKey: 'test-key',
        model: 'gpt-4',
        maxRetries: 3
      })

      const messages: Message[] = [
        { role: 'user', content: 'Hello' }
      ]

      await expect(client.invoke(messages)).rejects.toThrow('Network error')
      expect(fetchMock).toHaveBeenCalledTimes(3)
    }, 10000)

    it('应该处理 HTTP 错误', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      })

      const client = new LLMClient({
        baseURL: 'https://api.example.com',
        apiKey: 'invalid-key',
        model: 'gpt-4',
        maxRetries: 1
      })

      const messages: Message[] = [
        { role: 'user', content: 'Hello' }
      ]

      await expect(client.invoke(messages)).rejects.toThrow('HTTP 401: Unauthorized')
    })

    it('应该支持中止信号', async () => {
      fetchMock.mockImplementation(() =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 5000)
        })
      )

      const client = new LLMClient({
        baseURL: 'https://api.example.com',
        apiKey: 'test-key',
        model: 'gpt-4',
        maxRetries: 1,
        timeout: 5000
      })

      const messages: Message[] = [
        { role: 'user', content: 'Hello' }
      ]

      const abortController = new AbortController()
      const promise = client.invoke(messages, undefined, abortController.signal)

      // 立即中止
      abortController.abort()

      await expect(promise).rejects.toThrow()
    })
  })

  describe('invokeStream 方法', () => {
    it('应该正确解析流式响应', async () => {
      const chunks = [
        'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n',
        'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"gpt-4","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n',
        'data: {"id":"1","object":"chat.completion.chunk","created":1234,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n',
        'data: [DONE]\n'
      ]

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          chunks.forEach(chunk => {
            controller.enqueue(encoder.encode(chunk))
          })
          controller.close()
        }
      })

      fetchMock.mockResolvedValueOnce({
        ok: true,
        body: stream
      })

      const client = new LLMClient({
        baseURL: 'https://api.example.com',
        apiKey: 'test-key',
        model: 'gpt-4'
      })

      const messages: Message[] = [
        { role: 'user', content: 'Hello' }
      ]

      const results = []
      for await (const chunk of client.invokeStream(messages)) {
        results.push(chunk)
      }

      expect(results).toHaveLength(3)
      expect(results[0].choices[0].delta.content).toBe('Hello')
      expect(results[1].choices[0].delta.content).toBe(' world')
    })

    it('应该处理无响应体的情况', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        body: null
      })

      const client = new LLMClient({
        baseURL: 'https://api.example.com',
        apiKey: 'test-key',
        model: 'gpt-4'
      })

      const messages: Message[] = [
        { role: 'user', content: 'Hello' }
      ]

      await expect(async () => {
        for await (const _ of client.invokeStream(messages)) {
          // Should not reach here
        }
      }).rejects.toThrow('No response body')
    })
  })
})

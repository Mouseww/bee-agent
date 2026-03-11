/**
 * BeeAgent LLM Client
 * @module @bee-agent/llm-client
 * @description OpenAI 兼容 API 客户端，支持多种 LLM 提供商
 *
 * @example
 * ```ts
 * import { LLMClient } from '@bee-agent/llm-client'
 *
 * const client = new LLMClient({
 *   baseURL: 'https://api.openai.com/v1',
 *   apiKey: 'sk-xxx',
 *   model: 'gpt-4'
 * })
 *
 * const result = await client.invoke([
 *   { role: 'user', content: 'Hello!' }
 * ])
 * ```
 */

export * from './types'
export { LLMClient, LLMApiError } from './client'

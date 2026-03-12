/**
 * BeeAgent Core
 * @module @bee-agent/agent-core
 * @description Re-Act Agent 核心实现，提供浏览器自动化的 Agent 引擎
 *
 * @example
 * ```ts
 * import { BeeAgent } from '@bee-agent/agent-core'
 *
 * const agent = new BeeAgent({
 *   baseURL: 'https://api.openai.com/v1',
 *   apiKey: 'sk-xxx',
 *   model: 'gpt-4'
 * })
 *
 * agent.addEventListener('step', (e) => {
 *   console.log('Step:', (e as CustomEvent).detail)
 * })
 *
 * const result = await agent.execute('搜索最新新闻')
 * ```
 */

export * from './types'
export { BeeAgent } from './agent'
export { createTools } from './tools'
export * from './watch'

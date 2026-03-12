/**
 * Watch Mode 模块导出
 * @module @bee-agent/agent-core/watch
 * @description 监听模式的所有公共 API
 */

export * from './types'
export { ChangeDetector } from './ChangeDetector'
export { TriggerEvaluator } from './TriggerEvaluator'
export { SessionMemory } from './SessionMemory'
export { RateLimiter } from './RateLimiter'
export { WatchEngine } from './WatchEngine'
export {
  presetChatAutoReply,
  presetDOMMonitor,
  presetPeriodicCheck,
  presetElementAppear,
  WATCH_PRESETS
} from './presets'

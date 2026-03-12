/**
 * 预设规则模板
 * @module @bee-agent/agent-core/watch
 * @description 常用监听场景的规则预设，用户可一键创建
 */

import type { WatchRule } from './types'

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 预设：聊天自动回复
 * @description 监听聊天容器中的新消息，自动根据上下文回复
 */
export function presetChatAutoReply(
  containerSelector = '.chat-messages',
  messageSelector = '.message',
  excludeSelector = '.message-self'
): WatchRule {
  return {
    id: generateId(),
    name: '聊天自动回复',
    enabled: true,
    trigger: {
      type: 'new_message',
      containerSelector,
      messageSelector,
      excludeSelector
    },
    instruction: `你是一个智能聊天助手。当检测到新消息时：
1. 阅读新消息内容和上下文
2. 根据对话上下文，生成合适的回复
3. 使用 type 工具在输入框中输入回复内容
4. 使用 click 或 keyboard 工具发送消息
注意：回复要自然、友好，符合对话场景。`,
    cooldownSeconds: 5,
    triggerCount: 0,
    lastTriggeredAt: 0
  }
}

/**
 * 预设：DOM 变化监控
 * @description 监控指定区域的 DOM 变化并记录
 */
export function presetDOMMonitor(
  selector = 'body',
  name = 'DOM 变化监控'
): WatchRule {
  return {
    id: generateId(),
    name,
    enabled: true,
    trigger: {
      type: 'dom_change',
      selector,
      childList: true,
      subtree: true
    },
    instruction: `你是一个页面变化监控助手。当检测到 DOM 变化时：
1. 分析变化的内容和性质
2. 判断变化是否重要（忽略样式更新、动画等无意义变化）
3. 如果变化重要，使用 done 工具记录变化的描述
4. 如果变化不重要，使用 done 工具说明已忽略`,
    cooldownSeconds: 10,
    triggerCount: 0,
    lastTriggeredAt: 0
  }
}

/**
 * 预设：定时检查
 * @description 定时检查页面指定区域的变化
 */
export function presetPeriodicCheck(
  selector = 'body',
  intervalSeconds = 30
): WatchRule {
  return {
    id: generateId(),
    name: '定时检查',
    enabled: true,
    trigger: {
      type: 'interval',
      intervalSeconds,
      selector
    },
    instruction: `你是一个定时监控助手。每次检查时：
1. 观察指定区域的当前状态
2. 与上次检查的快照对比
3. 如果有重要变化，使用 done 工具详细记录
4. 如果无变化，使用 done 工具简单说明`,
    cooldownSeconds: intervalSeconds,
    triggerCount: 0,
    lastTriggeredAt: 0
  }
}

/**
 * 预设：元素出现通知
 * @description 等待特定元素出现后执行操作
 */
export function presetElementAppear(
  selector: string,
  name = '元素出现通知'
): WatchRule {
  return {
    id: generateId(),
    name,
    enabled: true,
    trigger: {
      type: 'element_appear',
      selector,
      continuous: false
    },
    instruction: `你是一个元素监控助手。当指定元素出现时：
1. 读取元素的内容
2. 分析元素出现的含义
3. 使用 done 工具记录元素已出现及其内容`,
    cooldownSeconds: 0,
    triggerCount: 0,
    lastTriggeredAt: 0
  }
}

/** 所有可用的预设模板 */
export const WATCH_PRESETS = [
  { key: 'chat_auto_reply', name: '聊天自动回复', description: '监听新消息并自动回复', create: presetChatAutoReply },
  { key: 'dom_monitor', name: 'DOM 变化监控', description: '监控页面 DOM 变化', create: presetDOMMonitor },
  { key: 'periodic_check', name: '定时检查', description: '定时检查页面变化', create: presetPeriodicCheck },
  { key: 'element_appear', name: '元素出现通知', description: '等待特定元素出现', create: presetElementAppear }
] as const

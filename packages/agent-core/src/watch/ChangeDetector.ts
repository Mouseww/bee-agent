/**
 * DOM 变化检测器
 * @module @bee-agent/agent-core/watch
 * @description 基于 MutationObserver 检测 DOM 变化，支持消息容器监听和快照对比
 */

import type {
  WatchRule,
  PageChange,
  NewMessage,
  DOMChangeTrigger,
  NewMessageTrigger,
  IntervalTrigger,
  ElementAppearTrigger
} from './types'

/** 变化缓冲区最大条数 */
const DEFAULT_MAX_BUFFER = 100

/**
 * ChangeDetector - DOM 变化检测器
 *
 * 职责：
 * - 基于 MutationObserver 检测 DOM 变化（DOMChangeTrigger）
 * - 消息容器专用检测（NewMessageTrigger）
 * - 快照对比法（IntervalTrigger）
 * - 元素出现检测（ElementAppearTrigger）
 * - 变化缓冲区管理
 */
export class ChangeDetector {
  private observers: Map<string, MutationObserver> = new Map()
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map()
  private snapshots: Map<string, string> = new Map()
  private changeBuffer: PageChange[] = []
  private maxBuffer: number
  private knownMessageCounts: Map<string, number> = new Map()
  private knownElements: Map<string, boolean> = new Map()
  private onChange: (change: PageChange) => void

  constructor(
    onChange: (change: PageChange) => void,
    maxBuffer = DEFAULT_MAX_BUFFER
  ) {
    this.onChange = onChange
    this.maxBuffer = maxBuffer
  }

  /**
   * 为规则启动检测
   */
  startDetecting(rule: WatchRule): void {
    // 先停止已存在的检测
    this.stopDetecting(rule.id)

    switch (rule.trigger.type) {
      case 'dom_change':
        this.startDOMChangeDetection(rule.id, rule.trigger)
        break
      case 'new_message':
        this.startNewMessageDetection(rule.id, rule.trigger)
        break
      case 'interval':
        this.startIntervalDetection(rule.id, rule.trigger)
        break
      case 'element_appear':
        this.startElementAppearDetection(rule.id, rule.trigger)
        break
    }
  }

  /**
   * 停止指定规则的检测
   */
  stopDetecting(ruleId: string): void {
    const observer = this.observers.get(ruleId)
    if (observer) {
      observer.disconnect()
      this.observers.delete(ruleId)
    }

    const interval = this.intervals.get(ruleId)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(ruleId)
    }

    this.snapshots.delete(ruleId)
    this.knownMessageCounts.delete(ruleId)
    this.knownElements.delete(ruleId)
  }

  /**
   * 停止所有检测
   */
  stopAll(): void {
    for (const observer of this.observers.values()) {
      observer.disconnect()
    }
    this.observers.clear()

    for (const interval of this.intervals.values()) {
      clearInterval(interval)
    }
    this.intervals.clear()

    this.snapshots.clear()
    this.knownMessageCounts.clear()
    this.knownElements.clear()
  }

  /**
   * 获取并清空变化缓冲区
   */
  flushChanges(): PageChange[] {
    const changes = [...this.changeBuffer]
    this.changeBuffer = []
    return changes
  }

  /**
   * 获取缓冲区当前大小
   */
  getBufferSize(): number {
    return this.changeBuffer.length
  }

  /**
   * 从消息容器中提取最近的消息
   */
  extractMessages(trigger: NewMessageTrigger, count = 5): NewMessage[] {
    const container = document.querySelector(trigger.containerSelector)
    if (!container) return []

    let messageElements = Array.from(container.querySelectorAll(trigger.messageSelector))

    // 排除自己发送的消息
    if (trigger.excludeSelector) {
      messageElements = messageElements.filter(el => !el.matches(trigger.excludeSelector!))
    }

    // 取最后 count 条
    const recent = messageElements.slice(-count)

    return recent.map(el => ({
      sender: this.extractSender(el),
      content: el.textContent?.trim() || '',
      timestamp: Date.now(),
      rawHTML: el.outerHTML
    }))
  }

  // ── 私有方法 ──

  /**
   * DOM 变化检测（MutationObserver）
   */
  private startDOMChangeDetection(ruleId: string, trigger: DOMChangeTrigger): void {
    const target = document.querySelector(trigger.selector)
    if (!target) return

    const observer = new MutationObserver((mutations) => {
      const descriptions: string[] = []

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const added = mutation.addedNodes.length
          const removed = mutation.removedNodes.length
          if (added > 0 || removed > 0) {
            descriptions.push(`子节点变化: +${added} -${removed}`)
          }
        } else if (mutation.type === 'attributes') {
          descriptions.push(`属性变化: ${mutation.attributeName}`)
        } else if (mutation.type === 'characterData') {
          descriptions.push(`文本变化`)
        }
      }

      if (descriptions.length > 0) {
        this.pushChange({
          type: 'dom_mutation',
          ruleId,
          description: descriptions.join('; '),
          content: (target as HTMLElement).innerHTML.slice(0, 2000),
          timestamp: Date.now()
        })
      }
    })

    observer.observe(target, {
      attributes: trigger.attributes ?? true,
      childList: trigger.childList ?? true,
      characterData: trigger.characterData ?? false,
      subtree: trigger.subtree ?? true
    })

    this.observers.set(ruleId, observer)
  }

  /**
   * 新消息检测
   */
  private startNewMessageDetection(ruleId: string, trigger: NewMessageTrigger): void {
    const container = document.querySelector(trigger.containerSelector)
    if (!container) return

    // 记录当前消息数量
    const currentCount = this.countMessages(container, trigger)
    this.knownMessageCounts.set(ruleId, currentCount)

    const observer = new MutationObserver(() => {
      const newCount = this.countMessages(container, trigger)
      const known = this.knownMessageCounts.get(ruleId) ?? 0

      if (newCount > known) {
        const diff = newCount - known
        this.knownMessageCounts.set(ruleId, newCount)

        // 提取新消息的文本
        let messageElements = Array.from(container.querySelectorAll(trigger.messageSelector))
        if (trigger.excludeSelector) {
          messageElements = messageElements.filter(el => !el.matches(trigger.excludeSelector!))
        }
        const newMessages = messageElements.slice(-diff)
        const content = newMessages.map(el => el.textContent?.trim() || '').join('\n')

        this.pushChange({
          type: 'new_message',
          ruleId,
          description: `${diff} 条新消息`,
          content,
          timestamp: Date.now()
        })
      }
    })

    observer.observe(container, {
      childList: true,
      subtree: true
    })

    this.observers.set(ruleId, observer)
  }

  /**
   * 定时快照对比检测
   */
  private startIntervalDetection(ruleId: string, trigger: IntervalTrigger): void {
    // 初始快照
    const snapshot = this.takeSnapshot(trigger.selector)
    this.snapshots.set(ruleId, snapshot)

    const interval = setInterval(() => {
      const current = this.takeSnapshot(trigger.selector)
      const previous = this.snapshots.get(ruleId) ?? ''

      if (current !== previous) {
        this.snapshots.set(ruleId, current)
        this.pushChange({
          type: 'snapshot_diff',
          ruleId,
          description: '页面内容发生变化（定时检查）',
          content: current.slice(0, 2000),
          timestamp: Date.now()
        })
      }
    }, trigger.intervalSeconds * 1000)

    this.intervals.set(ruleId, interval)
  }

  /**
   * 元素出现检测
   */
  private startElementAppearDetection(ruleId: string, trigger: ElementAppearTrigger): void {
    // 先检查元素是否已存在
    const existing = document.querySelector(trigger.selector)
    if (existing) {
      this.knownElements.set(ruleId, true)
      if (!trigger.continuous) return
    } else {
      this.knownElements.set(ruleId, false)
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(trigger.selector)
      const wasKnown = this.knownElements.get(ruleId) ?? false

      if (element && !wasKnown) {
        this.knownElements.set(ruleId, true)
        this.pushChange({
          type: 'element_appeared',
          ruleId,
          description: `元素已出现: ${trigger.selector}`,
          content: (element as HTMLElement).outerHTML.slice(0, 2000),
          timestamp: Date.now()
        })

        // 非持续模式：触发一次后停止
        if (!trigger.continuous) {
          this.stopDetecting(ruleId)
        }
      } else if (!element && wasKnown && trigger.continuous) {
        // 持续模式下，元素消失后重置状态
        this.knownElements.set(ruleId, false)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    this.observers.set(ruleId, observer)
  }

  /**
   * 推入变化到缓冲区
   */
  private pushChange(change: PageChange): void {
    this.changeBuffer.push(change)

    // 缓冲区溢出保护
    if (this.changeBuffer.length > this.maxBuffer) {
      this.changeBuffer = this.changeBuffer.slice(-this.maxBuffer)
    }

    this.onChange(change)
  }

  /**
   * 统计消息数量（排除自己的消息）
   */
  private countMessages(container: Element, trigger: NewMessageTrigger): number {
    let elements = Array.from(container.querySelectorAll(trigger.messageSelector))
    if (trigger.excludeSelector) {
      elements = elements.filter(el => !el.matches(trigger.excludeSelector!))
    }
    return elements.length
  }

  /**
   * 拍摄页面快照
   */
  private takeSnapshot(selector?: string): string {
    if (selector) {
      const el = document.querySelector(selector)
      return el ? (el as HTMLElement).innerText.trim() : ''
    }
    return document.body.innerText.trim().slice(0, 5000)
  }

  /**
   * 从消息元素中提取发送者名称
   */
  private extractSender(messageEl: Element): string {
    // 尝试常见的发送者选择器
    const senderSelectors = [
      '[class*="sender"]', '[class*="author"]', '[class*="name"]',
      '[class*="nickname"]', '[class*="user"]'
    ]

    for (const sel of senderSelectors) {
      const senderEl = messageEl.querySelector(sel)
      if (senderEl?.textContent?.trim()) {
        return senderEl.textContent.trim()
      }
    }

    // 尝试前一个兄弟元素
    const prev = messageEl.previousElementSibling
    if (prev?.textContent?.trim() && (prev.textContent.trim().length < 30)) {
      return prev.textContent.trim()
    }

    return 'Unknown'
  }
}

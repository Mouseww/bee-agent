/**
 * BeeAgent 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BeeAgent } from '../agent'
import type { AgentConfig } from '../types'

// Mock dependencies
vi.mock('@bee-agent/dom-engine', () => ({
  DOMEngine: vi.fn().mockImplementation(() => ({
    getBrowserState: vi.fn().mockReturnValue({
      url: 'https://example.com',
      title: 'Test Page',
      header: 'Current Page: [Test Page](https://example.com)\nPage info: 1024x768px viewport',
      content: '[0]<button> Click me',
      footer: '[End of page]'
    }),
    cleanup: vi.fn()
  }))
}))

vi.mock('@bee-agent/llm-client', () => ({
  LLMClient: vi.fn().mockImplementation(() => {
    const eventTarget = new EventTarget()
    return {
      invoke: vi.fn(),
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget)
    }
  })
}))

vi.mock('../tools', () => ({
  createTools: vi.fn().mockReturnValue([])
}))

describe('BeeAgent', () => {
  let config: AgentConfig

  beforeEach(() => {
    config = {
      baseURL: 'https://api.example.com',
      apiKey: 'test-key',
      model: 'gpt-4',
      temperature: 0.7,
      maxRetries: 3,
      timeout: 60000,
      maxSteps: 20
    }

    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('构造函数', () => {
    it('应该正确初始化 BeeAgent', () => {
      const agent = new BeeAgent(config)

      expect(agent).toBeInstanceOf(BeeAgent)
      expect(agent.getStatus()).toBe('idle')
      expect(agent.getSteps()).toEqual([])
    })

    it('应该使用默认配置', () => {
      const minimalConfig: AgentConfig = {
        baseURL: 'https://api.example.com',
        apiKey: 'test-key',
        model: 'gpt-4'
      }

      const agent = new BeeAgent(minimalConfig)

      expect(agent).toBeInstanceOf(BeeAgent)
      expect(agent.getStatus()).toBe('idle')
    })
  })

  describe('状态管理', () => {
    it('初始状态应该是 idle', () => {
      const agent = new BeeAgent(config)

      expect(agent.getStatus()).toBe('idle')
    })

    it('执行任务时状态应该变为 running 然后 completed', async () => {
      const { LLMClient } = await import('@bee-agent/llm-client')
      const { createTools } = await import('../tools')

      // @ts-ignore
      LLMClient.mockImplementation(() => ({
        invoke: vi.fn().mockResolvedValue({
          content: 'Task completed',
          toolCalls: [
            {
              id: 'call-1',
              type: 'function',
              function: {
                name: 'done',
                arguments: JSON.stringify({ success: true, message: 'Done' })
              }
            }
          ],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
        }),
        addEventListener: vi.fn()
      }))

      // @ts-ignore
      createTools.mockReturnValue([
        {
          name: 'done',
          description: 'Complete the task',
          parameters: {},
          execute: vi.fn().mockResolvedValue('Task completed')
        }
      ])

      const agent = new BeeAgent(config)
      const statusChanges: string[] = []

      agent.addEventListener('statuschange', (e: Event) => {
        statusChanges.push((e as CustomEvent).detail.status)
      })

      await agent.execute('Test task')

      expect(statusChanges).toContain('running')
      expect(statusChanges).toContain('completed')
      expect(agent.getStatus()).toBe('completed')
    })

    it('任务失败后状态应该变为 error', async () => {
      const { LLMClient } = await import('@bee-agent/llm-client')

      // @ts-ignore
      LLMClient.mockImplementation(() => ({
        invoke: vi.fn().mockRejectedValue(new Error('LLM error')),
        addEventListener: vi.fn()
      }))

      const agent = new BeeAgent(config)
      const result = await agent.execute('Test task')

      expect(agent.getStatus()).toBe('error')
      expect(result.success).toBe(false)
    })
  })

  describe('stop 方法', () => {
    it('stop 后状态应该变为 idle', () => {
      const agent = new BeeAgent(config)

      agent.stop()

      expect(agent.getStatus()).toBe('idle')
    })

    it('应该清理 DOM 引擎', () => {
      const agent = new BeeAgent(config)

      agent.stop()

      expect(agent.getStatus()).toBe('idle')
    })
  })

  describe('execute 方法', () => {
    it('不应该允许并发执行', async () => {
      const { LLMClient } = await import('@bee-agent/llm-client')
      const { createTools } = await import('../tools')

      // @ts-ignore
      LLMClient.mockImplementation(() => ({
        invoke: vi.fn().mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve({
            content: 'Task completed',
            toolCalls: [
              {
                id: 'call-1',
                type: 'function',
                function: {
                  name: 'done',
                  arguments: JSON.stringify({ success: true, message: 'Done' })
                }
              }
            ],
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
          }), 100))
        ),
        addEventListener: vi.fn()
      }))

      // @ts-ignore
      createTools.mockReturnValue([
        {
          name: 'done',
          description: 'Complete the task',
          parameters: {},
          execute: vi.fn().mockResolvedValue('Task completed')
        }
      ])

      const agent = new BeeAgent(config)

      const promise1 = agent.execute('Task 1')
      const promise2 = agent.execute('Task 2')

      await expect(promise2).rejects.toThrow('Agent is already running')
      await promise1
    })

    it('应该记录执行步骤', async () => {
      const { LLMClient } = await import('@bee-agent/llm-client')
      const { createTools } = await import('../tools')

      // @ts-ignore
      LLMClient.mockImplementation(() => ({
        invoke: vi.fn().mockResolvedValue({
          content: 'Task completed',
          toolCalls: [
            {
              id: 'call-1',
              type: 'function',
              function: {
                name: 'done',
                arguments: JSON.stringify({ success: true, message: 'Done' })
              }
            }
          ],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
        }),
        addEventListener: vi.fn()
      }))

      // @ts-ignore
      createTools.mockReturnValue([
        {
          name: 'done',
          description: 'Complete the task',
          parameters: {},
          execute: vi.fn().mockResolvedValue('Task completed')
        }
      ])

      const agent = new BeeAgent(config)
      await agent.execute('Test task')

      const steps = agent.getSteps()
      expect(steps.length).toBeGreaterThan(0)
      expect(steps[0]).toHaveProperty('index')
      expect(steps[0]).toHaveProperty('observation')
      expect(steps[0]).toHaveProperty('thought')
      expect(steps[0]).toHaveProperty('action')
      expect(steps[0]).toHaveProperty('timestamp')
    })

    it('应该在达到最大步骤数时停止', async () => {
      const shortConfig: AgentConfig = {
        ...config,
        maxSteps: 2
      }

      const { LLMClient } = await import('@bee-agent/llm-client')
      const { createTools } = await import('../tools')

      // @ts-ignore
      LLMClient.mockImplementation(() => ({
        invoke: vi.fn().mockResolvedValue({
          content: 'Continue',
          toolCalls: [
            {
              id: 'call-1',
              type: 'function',
              function: {
                name: 'scroll',
                arguments: JSON.stringify({ direction: 'down' })
              }
            }
          ],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
        }),
        addEventListener: vi.fn()
      }))

      // @ts-ignore
      createTools.mockReturnValue([
        {
          name: 'scroll',
          description: 'Scroll the page',
          parameters: {},
          execute: vi.fn().mockResolvedValue('Scrolled')
        }
      ])

      const agent = new BeeAgent(shortConfig)
      const result = await agent.execute('Test task')

      expect(result.success).toBe(false)
      expect(result.message).toContain('Maximum steps')
      expect(agent.getSteps().length).toBe(2)
    })

    it('应该触发 step 事件', async () => {
      const { LLMClient } = await import('@bee-agent/llm-client')
      const { createTools } = await import('../tools')

      // @ts-ignore
      LLMClient.mockImplementation(() => ({
        invoke: vi.fn().mockResolvedValue({
          content: 'Task completed',
          toolCalls: [
            {
              id: 'call-1',
              type: 'function',
              function: {
                name: 'done',
                arguments: JSON.stringify({ success: true, message: 'Done' })
              }
            }
          ],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
        }),
        addEventListener: vi.fn()
      }))

      // @ts-ignore
      createTools.mockReturnValue([
        {
          name: 'done',
          description: 'Complete the task',
          parameters: {},
          execute: vi.fn().mockResolvedValue('Task completed')
        }
      ])

      const agent = new BeeAgent(config)
      const stepEvents: any[] = []

      agent.addEventListener('step', (e: Event) => {
        stepEvents.push((e as CustomEvent).detail)
      })

      await agent.execute('Test task')

      expect(stepEvents.length).toBeGreaterThan(0)
      expect(stepEvents.some(e => e.type === 'observe')).toBe(true)
      expect(stepEvents.some(e => e.type === 'think')).toBe(true)
      expect(stepEvents.some(e => e.type === 'act')).toBe(true)
      expect(stepEvents.some(e => e.type === 'complete')).toBe(true)
    })
  })

  describe('dispose 方法', () => {
    it('应该清理所有资源', () => {
      const agent = new BeeAgent(config)

      agent.dispose()

      expect(agent.getStatus()).toBe('idle')
    })
  })
})

/**
 * mountBeeAgentUI 单元测试
 * @description 测试 UI 挂载函数的创建、卸载、防重复挂载逻辑
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock BeeAgentUI 组件，避免渲染真实组件树
vi.mock('../BeeAgentUI', () => ({
  BeeAgentUI: () => null
}))

// Mock CSS import
vi.mock('../styles.css', () => ({}))

// Mock react-dom/client — vi.mock 工厂函数内不能使用外部变量
vi.mock('react-dom/client', () => {
  const render = vi.fn()
  const unmount = vi.fn()
  return {
    createRoot: vi.fn(() => ({ render, unmount }))
  }
})

import { createRoot } from 'react-dom/client'
import { mountBeeAgentUI } from '../index'

/** 创建 BeeAgent mock 实例 */
function createMockAgent() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    execute: vi.fn().mockResolvedValue({ success: true, message: 'Done' }),
    stop: vi.fn(),
    getStatus: vi.fn().mockReturnValue('idle'),
    getSteps: vi.fn().mockReturnValue([]),
    dispose: vi.fn()
  } as any
}

/** 获取 createRoot 返回的 mock root 对象 */
function getMockRoot() {
  const mockedCreateRoot = vi.mocked(createRoot)
  const lastCall = mockedCreateRoot.mock.results[mockedCreateRoot.mock.results.length - 1]
  return lastCall?.value as { render: ReturnType<typeof vi.fn>; unmount: ReturnType<typeof vi.fn> }
}

describe('mountBeeAgentUI', () => {
  let agent: ReturnType<typeof createMockAgent>

  beforeEach(() => {
    agent = createMockAgent()
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('挂载', () => {
    it('应该创建 #bee-agent-ui-root 容器并挂载到 body', () => {
      mountBeeAgentUI(agent)

      const container = document.getElementById('bee-agent-ui-root')
      expect(container).not.toBeNull()
      expect(container?.parentElement).toBe(document.body)
    })

    it('应该调用 createRoot 创建 React 根节点', () => {
      mountBeeAgentUI(agent)

      const mockedCreateRoot = vi.mocked(createRoot)
      expect(mockedCreateRoot).toHaveBeenCalledOnce()
      // Shadow DOM 模式下，createRoot 接收的是 shadow 内部的 mountPoint
      const callArg = mockedCreateRoot.mock.calls[0][0] as HTMLElement
      expect(callArg.id).toBe('bee-agent-shadow-root')
    })

    it('应该调用 root.render 渲染组件', () => {
      mountBeeAgentUI(agent)

      const root = getMockRoot()
      expect(root.render).toHaveBeenCalledOnce()
    })

    it('应该返回一个卸载函数', () => {
      const unmount = mountBeeAgentUI(agent)

      expect(typeof unmount).toBe('function')
    })
  })

  describe('卸载', () => {
    it('卸载函数应该调用 root.unmount 并移除容器', () => {
      const unmountFn = mountBeeAgentUI(agent)
      const root = getMockRoot()
      expect(document.getElementById('bee-agent-ui-root')).not.toBeNull()

      unmountFn()

      expect(root.unmount).toHaveBeenCalledOnce()
      expect(document.getElementById('bee-agent-ui-root')).toBeNull()
    })

    it('多次调用卸载函数不应抛出错误', () => {
      const unmountFn = mountBeeAgentUI(agent)
      const root = getMockRoot()

      unmountFn()
      // 第二次调用不应报错（root 已为 null，只执行 container.remove）
      expect(() => unmountFn()).not.toThrow()
      expect(root.unmount).toHaveBeenCalledOnce()
    })
  })

  describe('防重复挂载', () => {
    it('重复挂载时应该先移除旧容器', () => {
      // 第一次挂载
      mountBeeAgentUI(agent)
      expect(document.getElementById('bee-agent-ui-root')).not.toBeNull()

      // 第二次挂载
      mountBeeAgentUI(agent)
      const containers = document.querySelectorAll('#bee-agent-ui-root')

      // 应该只有一个容器
      expect(containers.length).toBe(1)
    })

    it('重复挂载应该创建全新的 React Root', () => {
      mountBeeAgentUI(agent)
      mountBeeAgentUI(agent)

      const mockedCreateRoot = vi.mocked(createRoot)
      // createRoot 应该被调用两次（每次挂载一次）
      expect(mockedCreateRoot).toHaveBeenCalledTimes(2)
    })
  })
})

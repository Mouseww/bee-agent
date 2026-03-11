/**
 * Agent 工具定义
 * @module @bee-agent/agent-core
 * @description 定义 Agent 可用的所有工具（函数），包括 DOM 操作、页面控制和任务管理
 */

import type { DOMEngine } from '@bee-agent/dom-engine'
import type { AgentTool, AgentConfig, ToolInput } from './types'

/**
 * 安全提取整数参数
 * @param input - 工具输入
 * @param key - 参数名
 * @returns 整数值
 * @throws {Error} 参数缺失或不是有效数字
 */
function requireInt(input: ToolInput, key: string): number {
  const value = input[key]
  if (value === undefined || value === null) {
    throw new Error(`Missing required parameter: ${key}`)
  }
  const num = Number(value)
  if (isNaN(num)) {
    throw new Error(`Parameter "${key}" must be a number, got: ${typeof value}`)
  }
  return Math.round(num)
}

/**
 * 安全提取字符串参数
 * @param input - 工具输入
 * @param key - 参数名
 * @returns 字符串值
 * @throws {Error} 参数缺失或不是字符串
 */
function requireString(input: ToolInput, key: string): string {
  const value = input[key]
  if (value === undefined || value === null) {
    throw new Error(`Missing required parameter: ${key}`)
  }
  return String(value)
}

/**
 * 安全提取数字参数（可选，带默认值）
 * @param input - 工具输入
 * @param key - 参数名
 * @param defaultValue - 默认值
 * @returns 数字值
 */
function optionalNumber(input: ToolInput, key: string, defaultValue: number): number {
  const value = input[key]
  if (value === undefined || value === null) return defaultValue
  const num = Number(value)
  return isNaN(num) ? defaultValue : num
}

/**
 * 创建 Agent 可用的工具集
 * @description 包含 DOM 操作工具、页面控制工具和任务管理工具
 * @param domEngine - DOM 引擎实例
 * @param config - 可选配置（包含 onAskUser 回调）
 * @returns 工具列表
 */
export function createTools(domEngine: DOMEngine, config?: Pick<AgentConfig, 'onAskUser'>): AgentTool[] {
  return [
    {
      name: 'click',
      description: 'Click an element by its index',
      parameters: {
        type: 'object',
        properties: {
          index: {
            type: 'number',
            description: 'The index of the element to click'
          }
        },
        required: ['index']
      },
      execute: async (input: ToolInput) => {
        const index = requireInt(input, 'index')
        return await domEngine.click(index)
      }
    },
    {
      name: 'type',
      description: 'Type text into an input element. This clears existing text before typing.',
      parameters: {
        type: 'object',
        properties: {
          index: {
            type: 'number',
            description: 'The index of the input element'
          },
          text: {
            type: 'string',
            description: 'The text to type'
          }
        },
        required: ['index', 'text']
      },
      execute: async (input: ToolInput) => {
        const index = requireInt(input, 'index')
        const text = requireString(input, 'text')
        return await domEngine.type(index, text)
      }
    },
    {
      name: 'select',
      description: 'Select an option from a dropdown by matching option text (case-insensitive)',
      parameters: {
        type: 'object',
        properties: {
          index: {
            type: 'number',
            description: 'The index of the select element'
          },
          option: {
            type: 'string',
            description: 'The option text to select (case-insensitive partial match)'
          }
        },
        required: ['index', 'option']
      },
      execute: async (input: ToolInput) => {
        const index = requireInt(input, 'index')
        const option = requireString(input, 'option')
        return await domEngine.select(index, option)
      }
    },
    {
      name: 'scroll',
      description: 'Scroll the page up or down by a specified number of pages',
      parameters: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['up', 'down'],
            description: 'The direction to scroll'
          },
          pages: {
            type: 'number',
            description: 'Number of pages to scroll (default: 1, supports decimal like 0.5)',
            default: 1
          }
        },
        required: ['direction']
      },
      execute: async (input: ToolInput) => {
        const direction = requireString(input, 'direction')
        if (direction !== 'up' && direction !== 'down') {
          throw new Error(`Invalid scroll direction: "${direction}". Must be "up" or "down".`)
        }
        const pages = optionalNumber(input, 'pages', 1)
        return await domEngine.scroll(direction, pages)
      }
    },
    {
      name: 'hover',
      description: 'Hover over an element to reveal tooltips, dropdown menus, or other hidden content',
      parameters: {
        type: 'object',
        properties: {
          index: {
            type: 'number',
            description: 'The index of the element to hover over'
          }
        },
        required: ['index']
      },
      execute: async (input: ToolInput) => {
        const index = requireInt(input, 'index')
        return await domEngine.hover(index)
      }
    },
    {
      name: 'keyboard',
      description: 'Press a keyboard key on an element (e.g., Enter, Escape, Tab, ArrowDown, ArrowUp, Backspace, Delete)',
      parameters: {
        type: 'object',
        properties: {
          index: {
            type: 'number',
            description: 'The index of the element to send key to'
          },
          key: {
            type: 'string',
            description: 'The key to press (e.g., "Enter", "Escape", "Tab", "ArrowDown")'
          }
        },
        required: ['index', 'key']
      },
      execute: async (input: ToolInput) => {
        const index = requireInt(input, 'index')
        const key = requireString(input, 'key')
        return await domEngine.keyboard(index, key)
      }
    },
    {
      name: 'wait',
      description: 'Wait for a specified number of seconds. Useful for waiting for page loads, animations, or AJAX requests.',
      parameters: {
        type: 'object',
        properties: {
          seconds: {
            type: 'number',
            description: 'Number of seconds to wait (1-10)',
            minimum: 1,
            maximum: 10
          }
        },
        required: ['seconds']
      },
      execute: async (input: ToolInput) => {
        const seconds = optionalNumber(input, 'seconds', 1)
        return await domEngine.wait(seconds)
      }
    },
    {
      name: 'wait_for',
      description: 'Wait for a specific element to appear on the page using a CSS selector',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector of the element to wait for'
          },
          timeout: {
            type: 'number',
            description: 'Maximum time to wait in milliseconds (default: 5000)',
            default: 5000
          }
        },
        required: ['selector']
      },
      execute: async (input: ToolInput) => {
        const selector = requireString(input, 'selector')
        const timeout = optionalNumber(input, 'timeout', 5000)
        return await domEngine.waitFor(selector, timeout)
      }
    },
    {
      name: 'ask_user',
      description: 'Ask the user a question and wait for their answer. Use this when you need more information, clarification, or a decision from the user.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question to ask the user'
          }
        },
        required: ['question']
      },
      execute: async (input: ToolInput) => {
        const question = requireString(input, 'question')
        if (config?.onAskUser) {
          try {
            const answer = await config.onAskUser(question)
            return `User answered: ${answer}`
          } catch (error) {
            return `Failed to get user response: ${error instanceof Error ? error.message : String(error)}`
          }
        }
        return 'ask_user tool is not available. The agent cannot ask questions in this context. Please provide all necessary information upfront.'
      }
    },
    {
      name: 'done',
      description: 'Mark the task as completed. Use success=true only if the task was fully accomplished.',
      parameters: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the task was successfully completed'
          },
          message: {
            type: 'string',
            description: 'Summary message describing the result'
          }
        },
        required: ['success', 'message']
      },
      execute: async (input: ToolInput) => {
        const success = Boolean(input.success)
        const message = requireString(input, 'message')
        return `Task ${success ? 'succeeded' : 'failed'}: ${message}`
      }
    }
  ]
}

/**
 * Agent 工具定义
 */

import type { DOMEngine } from '@bee-agent/dom-engine'
import type { AgentTool, AgentConfig } from './types'

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
      execute: async (input: { index: number }) => {
        return await domEngine.click(input.index)
      }
    },
    {
      name: 'type',
      description: 'Type text into an input element',
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
      execute: async (input: { index: number; text: string }) => {
        return await domEngine.type(input.index, input.text)
      }
    },
    {
      name: 'select',
      description: 'Select an option from a dropdown',
      parameters: {
        type: 'object',
        properties: {
          index: {
            type: 'number',
            description: 'The index of the select element'
          },
          option: {
            type: 'string',
            description: 'The option text to select'
          }
        },
        required: ['index', 'option']
      },
      execute: async (input: { index: number; option: string }) => {
        return await domEngine.select(input.index, input.option)
      }
    },
    {
      name: 'scroll',
      description: 'Scroll the page up or down',
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
            description: 'Number of pages to scroll (default: 1)',
            default: 1
          }
        },
        required: ['direction']
      },
      execute: async (input: { direction: 'up' | 'down'; pages?: number }) => {
        return await domEngine.scroll(input.direction, input.pages || 1)
      }
    },
    {
      name: 'hover',
      description: 'Hover over an element to reveal tooltips or menus',
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
      execute: async (input: { index: number }) => {
        return await domEngine.hover(input.index)
      }
    },
    {
      name: 'keyboard',
      description: 'Press a keyboard key (Enter, Escape, Tab, ArrowDown, etc.)',
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
      execute: async (input: { index: number; key: string }) => {
        return await domEngine.keyboard(input.index, input.key)
      }
    },
    {
      name: 'wait',
      description: 'Wait for x seconds. Can be used to wait until the page or data is fully loaded.',
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
      execute: async (input: { seconds: number }) => {
        return await domEngine.wait(input.seconds)
      }
    },
    {
      name: 'wait_for',
      description: 'Wait for a specific element to appear on the page',
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
      execute: async (input: { selector: string; timeout?: number }) => {
        return await domEngine.waitFor(input.selector, input.timeout || 5000)
      }
    },
    {
      name: 'ask_user',
      description: 'Ask the user a question and wait for their answer. Use this if you need more information or clarification.',
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
      execute: async (input: { question: string }) => {
        if (config?.onAskUser) {
          const answer = await config.onAskUser(input.question)
          return `User answered: ${answer}`
        }
        return 'ask_user tool is not available. The agent cannot ask questions in this context. Please provide all necessary information upfront.'
      }
    },
    {
      name: 'done',
      description: 'Mark the task as completed',
      parameters: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the task was successful'
          },
          message: {
            type: 'string',
            description: 'Summary message'
          }
        },
        required: ['success', 'message']
      },
      execute: async (input: { success: boolean; message: string }) => {
        return `Task completed: ${input.message}`
      }
    }
  ]
}

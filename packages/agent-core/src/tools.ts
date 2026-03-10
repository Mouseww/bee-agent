/**
 * Agent 工具定义
 */

import type { DOMEngine } from '@bee-agent/dom-engine'
import type { AgentTool } from './types'

export function createTools(domEngine: DOMEngine): AgentTool[] {
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

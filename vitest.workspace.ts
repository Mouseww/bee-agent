import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'packages/llm-client',
  'packages/agent-core',
  'packages/dom-engine',
  'packages/ui',
  'packages/extension'
])

import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@bee-agent/dom-engine': resolve(__dirname, '../dom-engine/src/index.ts'),
      '@bee-agent/llm-client': resolve(__dirname, '../llm-client/src/index.ts')
    }
  },
  test: {
    globals: true,
    environment: 'node'
  }
})

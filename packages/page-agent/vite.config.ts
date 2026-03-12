import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['iife'],
      fileName: () => 'bee-agent.js',
      name: 'BeeAgent'
    },
    rollupOptions: {
      // 将所有依赖打包到单文件中
      external: [],
      output: {
        globals: {}
      }
    },
    // CSS 内联到 JS 中，不生成单独的 CSS 文件
    cssCodeSplit: false,
    minify: true,
    sourcemap: false
  }
})

/**
 * 生成 Bookmarklet 代码
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 读取构建后的 IIFE 文件
const distPath = resolve(__dirname, '../dist/bee-agent.js')
const outputPath = resolve(__dirname, '../dist/bookmarklet.txt')

try {
  const code = readFileSync(distPath, 'utf-8')

  // 压缩代码（简单处理）
  const minified = code
    .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
    .replace(/\/\/.*/g, '') // 移除单行注释
    .replace(/\s+/g, ' ') // 压缩空白
    .trim()

  // 生成 bookmarklet
  const bookmarklet = `javascript:(function(){${minified}})();`

  // 保存到文件
  writeFileSync(outputPath, bookmarklet, 'utf-8')

  console.log('✅ Bookmarklet 生成成功！')
  console.log(`📁 输出路径: ${outputPath}`)
  console.log(`📊 原始大小: ${(code.length / 1024).toFixed(2)} KB`)
  console.log(`📊 压缩后: ${(bookmarklet.length / 1024).toFixed(2)} KB`)
  console.log('\n使用方法:')
  console.log('1. 复制 bookmarklet.txt 中的内容')
  console.log('2. 在浏览器中创建新书签')
  console.log('3. 将复制的内容粘贴到书签的 URL 字段')
  console.log('4. 访问任意网页，点击书签即可激活 BeeAgent')

} catch (error) {
  console.error('❌ 生成失败:', error.message)
  process.exit(1)
}

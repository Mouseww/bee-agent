# @bee-agent/dom-engine

浏览器页面 DOM 解析与操作引擎，负责可交互元素识别、状态提取和 DOM 操作执行。

## Features

- **智能元素扫描**：自动识别页面中可交互元素（按钮、链接、输入框、下拉菜单等）
- **视口感知**：支持视口扩展范围配置，可选全页面模式（`-1`）
- **树形文本输出**：将元素层级关系转换为 Agent 可理解的缩进文本格式
- **彩色高亮遮罩**：8 色循环方案标注可交互元素索引，支持动画和位置自动更新
- **完整 DOM 操作**：点击、输入、选择、滚动、悬停、键盘等操作的真实事件模拟
- **黑名单过滤**：支持 CSS 选择器黑名单，跳过广告等干扰元素

## Usage

```ts
import { DOMEngine } from '@bee-agent/dom-engine'

// 创建引擎
const engine = new DOMEngine({
  viewportExpansion: 200,       // 视口扩展像素，-1 为全页面
  includeAttributes: true,      // 输出包含元素属性
  blacklist: ['.ad', '#popup']  // 黑名单选择器
})

// 获取浏览器状态（供 Agent 观察）
const state = engine.getBrowserState()
// state.interactiveElements - 可交互元素列表
// state.textDescription     - 文本化的页面描述

// DOM 操作
await engine.click(5)                      // 点击索引为 5 的元素
await engine.type(3, 'Hello World')        // 在索引 3 输入文本
await engine.select(7, 'option text')      // 选择下拉选项
await engine.scroll('down', 2)             // 向下滚动 2 页
await engine.hover(10)                     // 悬停元素
await engine.keyboard(3, 'Enter')          // 按键
await engine.waitForElement('.result', 5000) // 等待元素出现

// 清理
engine.dispose()
```

## Core Modules

| 模块 | 说明 |
|------|------|
| `DOMEngine` | 主引擎类，整合扫描、操作、高亮 |
| `scanInteractiveElements()` | 扫描可交互元素 |
| `elementsToText()` | 元素列表转文本（树形层级） |
| `clickElement()` / `inputText()` / `selectOption()` | DOM 操作函数 |
| `scrollVertical()` / `scrollHorizontal()` | 滚动控制 |
| `highlightElements()` / `clearHighlights()` | 高亮遮罩管理 |

## Dependencies

无内部包依赖（独立底层包）。

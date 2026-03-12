# 🐝 BeeAgent Web Controller

**网页内嵌 AI Agent —— 用自然语言控制任意网页。**

**In-page AI Agent — control any webpage with natural language.**

BeeQueen 集团自研项目，灵感来源于 [alibaba/page-agent](https://github.com/nicepkg/page-agent)，完全自主实现。

An in-house project by BeeQueen Group, inspired by [alibaba/page-agent](https://github.com/nicepkg/page-agent), built from scratch.

---

## ✨ 核心能力 / Features

| 能力 | Feature | 说明 / Description |
|------|---------|-------------------|
| 🤖 智能 Agent | Smart Agent | 基于 ReAct（Reasoning + Acting）框架的自主决策循环 / Autonomous decision loop based on ReAct |
| 🎯 DOM 操作 | DOM Control | 精确的元素定位、高亮标注和交互 / Precise element targeting, highlighting & interaction |
| 💬 自然语言 | Natural Language | 用中文或英文描述任务即可执行 / Describe tasks in Chinese or English |
| 🎨 现代 UI | Modern UI | 可拖拽、折叠、深色模式的浮动面板 / Draggable, collapsible, dark-mode floating panel |
| 📊 步骤可视化 | Step Timeline | 实时查看 Agent 的 Observe → Think → Act 过程 / Live view of Agent's reasoning & actions |
| 🔄 反思机制 | Reflection | 每步自我评估 + FIFO 记忆队列 / Per-step self-evaluation + FIFO memory queue |
| 🔌 多种部署 | Multiple Deploy | Chrome 扩展、Bookmarklet、直接注入 / Extension, Bookmarklet, Direct injection |
| 🔑 模型兼容 | Model Compat | 支持任何 OpenAI 兼容 API / Any OpenAI-compatible API (GPT, Claude, Qwen, DeepSeek...) |

---
## 页面截图
<img width="374" height="607" alt="image" src="https://github.com/user-attachments/assets/54119aee-bc16-4157-bf07-6034a81f64d8" />
<img width="640" height="945" alt="image" src="https://github.com/user-attachments/assets/dc40f82d-ffba-4b9a-afd7-36f8688c2333" />
<img width="377" height="944" alt="image" src="https://github.com/user-attachments/assets/be0e7dd8-cf30-4526-bd30-a2d225cdbdea" />

---

## 📦 项目架构 / Architecture

```
bee-agent/
├── packages/
│   ├── dom-engine/      # DOM 操作引擎 / DOM Engine (highlight, parser, actions)
│   ├── agent-core/      # Agent 核心 / Agent Core (ReAct loop, tools, reflection)
│   ├── llm-client/      # LLM 客户端 / LLM Client (OpenAI-compatible, retry, SSE)
│   ├── ui/              # React UI 组件 / UI Components (drag, theme, settings)
│   ├── extension/       # Chrome 扩展 / Chrome Extension (Manifest V3)
│   └── page-agent/      # IIFE 构建 / IIFE Build (Bookmarklet, direct injection)
├── package.json         # Monorepo root (npm workspaces)
└── README.md
```

### 分层架构图 / Layered Architecture

```
┌─────────────────────────────────────────────────┐
│              Deployment Layer                    │
│  Chrome Extension │ Bookmarklet │ Direct Inject  │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│               BeeAgent UI (@bee-agent/ui)        │
│   React 浮动面板 / Floating Panel                │
│   消息列表 · 步骤时间线 · 设置 · 主题切换         │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│           BeeAgent Core (@bee-agent/agent-core)  │
│   ReAct 循环 / ReAct Loop                        │
│   Observe → Think → Act → Reflect                │
│   10 种工具: click, type, select, scroll,         │
│   hover, keyboard, wait, wait_for, ask_user, done│
└──────────┬─────────────────────────┬────────────┘
           │                         │
┌──────────▼──────────┐   ┌─────────▼─────────────┐
│  DOM Engine          │   │  LLM Client            │
│  (@bee-agent/        │   │  (@bee-agent/           │
│   dom-engine)        │   │   llm-client)           │
│                      │   │                         │
│  · DOM 树解析        │   │  · OpenAI Chat API      │
│  · 可交互元素提取    │   │  · Tool Calls 解析      │
│  · 彩色高亮遮罩层    │   │  · SSE 流式支持         │
│  · 元素点击/输入/    │   │  · 指数退避重试         │
│    滚动/hover        │   │  · AbortController      │
└─────────────────────┘   └─────────────────────────┘
```

---

## 🚀 快速开始 / Getting Started

### 环境要求 / Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9 (支持 workspaces)
- 一个 **OpenAI 兼容的 API Key** / An OpenAI-compatible API key

### 安装依赖 / Install Dependencies

```bash
git clone <your-repo-url> bee-agent
cd bee-agent
npm install
```

### 构建所有包 / Build All Packages

```bash
npm run build
```

### 开发模式 / Development Mode

```bash
npm run dev
```

### 清理构建产物 / Clean Build Artifacts

```bash
npm run clean
```

### 运行测试 / Run Tests

```bash
npm test
```

---

## 📱 使用方式 / Usage

### 方式 1: Chrome 扩展 / Chrome Extension

> 推荐方式，支持完整的 UI 面板和快捷键。
> Recommended — full UI panel and keyboard shortcuts.

**构建 / Build:**

```bash
npm run build        # 先构建所有依赖包
```

**安装到 Chrome / Load in Chrome:**

1. 打开 `chrome://extensions/` / Open `chrome://extensions/`
2. 启用「开发者模式」/ Enable "Developer mode"
3. 点击「加载已解压的扩展程序」/ Click "Load unpacked"
4. 选择 `packages/extension/dist` 目录 / Select the `packages/extension/dist` directory

**配置 / Configure:**

1. 点击扩展图标，在弹出窗口中输入 API Key、Base URL 和模型名 / Click extension icon, enter API Key, Base URL, and model name
2. 点击「保存设置」/ Click "Save Settings"
3. 点击「激活 BeeAgent」或按 `Ctrl+Shift+B` / Click "Activate" or press `Ctrl+Shift+B`

### 方式 2: Bookmarklet

> 无需安装扩展，适合快速体验。
> No extension needed, great for quick testing.

**构建 / Build:**

```bash
cd packages/page-agent
npm run build
npm run generate-bookmarklet
```

**使用 / Use:**

1. 复制 `dist/bookmarklet.txt` 中的内容 / Copy contents of `dist/bookmarklet.txt`
2. 在浏览器中创建新书签 / Create a new bookmark in your browser
3. 将内容粘贴到书签的 URL 字段 / Paste the content into the bookmark's URL field
4. 访问任意网页，点击书签即可激活 / Visit any webpage and click the bookmark to activate

### 方式 3: 直接注入 / Direct Script Injection

> 适合集成到自己的项目中。
> Ideal for integrating into your own project.

```html
<script src="https://your-cdn.com/bee-agent.js"></script>
<script>
  window.initBeeAgent({
    apiKey: 'your-api-key',
    model: 'gpt-4',
    baseURL: 'https://api.openai.com/v1',  // 可选 / Optional
    language: 'zh-CN'                       // 可选 / Optional
  });
</script>
```

---

## 🎮 使用示例 / Examples

在 BeeAgent 面板的输入框中输入自然语言指令即可：
Type natural language instructions in the BeeAgent panel:

```
"点击登录按钮"             → Click the login button
"填写用户名为 admin"       → Fill in username as admin
"滚动到页面底部"           → Scroll to the bottom of the page
"选择下拉菜单中的'中文'"   → Select '中文' from the dropdown
"等待搜索结果加载完成"     → Wait for search results to load
"查找所有商品的价格"       → Find all product prices
```

---

## 🛠️ 可用工具 / Available Tools

Agent 内置 10 种 DOM 操作工具 / 10 built-in DOM tools:

| 工具 / Tool | 说明 / Description |
|-------------|-------------------|
| `click` | 点击指定索引的元素 / Click element by index |
| `type` | 在输入框中输入文本（先清空）/ Type text into input (clears first) |
| `select` | 从下拉菜单选择选项（模糊匹配）/ Select dropdown option (fuzzy match) |
| `scroll` | 向上/下滚动页面 / Scroll page up or down |
| `hover` | 悬停元素以显示提示/菜单 / Hover to reveal tooltips/menus |
| `keyboard` | 发送键盘按键（Enter, Escape, Tab 等）/ Send keyboard keys |
| `wait` | 等待指定秒数 / Wait for N seconds |
| `wait_for` | 等待特定 CSS 选择器的元素出现 / Wait for element by CSS selector |
| `ask_user` | 向用户提问并等待回答 / Ask user a question |
| `done` | 标记任务完成/失败 / Mark task as completed/failed |

---

## 🎨 UI 功能 / UI Features

- **拖拽移动 / Drag**: 按住标题栏拖动面板（带视口边界限制）
- **折叠/展开 / Collapse**: 点击 ▼/▲ 按钮最小化面板
- **主题切换 / Theme**: 点击 ☀/☽ 切换深色/浅色模式（持久化）
- **设置面板 / Settings**: 点击 ⚙ 配置 API Key、Base URL、模型
- **模型获取 / Fetch Models**: 在设置中一键获取 API 可用模型列表
- **快捷键 / Hotkey**: `Ctrl+Shift+B` 打开/关闭面板
- **Markdown 渲染 / Markdown**: 支持粗体、斜体、代码块（带 XSS 防护）
- **步骤时间线 / Timeline**: 可视化展示每步的 Observe → Think → Act → Reflect

---

## 🔧 技术栈 / Tech Stack

| 技术 / Tech | 用途 / Purpose |
|-------------|---------------|
| **TypeScript** | 全项目类型安全 / Full type safety (strict mode, ES2022) |
| **React 18** | UI 组件框架 / UI component framework |
| **Vite 6** | 构建工具（ESM + IIFE + Chrome Extension）/ Build tool |
| **npm workspaces** | Monorepo 包管理 / Monorepo package management |
| **vitest** | 单元测试 / Unit testing |
| **Chrome MV3** | 扩展清单 V3 / Extension Manifest V3 |

---

## 📐 ReAct 循环详解 / ReAct Loop

BeeAgent 的核心运行机制（每步循环）：

```
┌──────────────────────────────────────────────────────────┐
│ Step N                                                    │
│                                                          │
│  1. Observe  ─→ DOM Engine 扫描页面，提取可交互元素        │
│                  Extract interactive elements from DOM    │
│                                                          │
│  2. Think    ─→ 构建 Prompt（含历史步骤 + 记忆 + 页面状态）│
│                  调用 LLM，获取结构化 JSON 输出             │
│                  Call LLM with context, get JSON output   │
│                                                          │
│  3. Act      ─→ 执行 LLM 返回的工具调用                   │
│                  Execute tool call returned by LLM        │
│                                                          │
│  4. Reflect  ─→ 解析 evaluation / memory / next_goal     │
│                  更新 FIFO 记忆队列                        │
│                  Update FIFO memory queue                 │
│                                                          │
│  循环直到: done() 被调用 / 达到 maxSteps / 连续错误 ≥ 3   │
│  Loop until: done() / maxSteps reached / 3+ errors       │
└──────────────────────────────────────────────────────────┘
```

---

## 🔐 安全机制 / Safety

- **XSS 防护**: UI 渲染先 `escapeHTML()` 再替换 Markdown 标记
- **参数校验**: Agent 配置 `maxSteps` 限制在 `[1, 100]`，`temperature` 限制在 `[0, 2]`
- **连续错误保护**: 连续 3 次错误自动中止，防止无限循环
- **重复动作检测**: 滑动窗口检测连续 4 步相同动作
- **AbortController**: 支持随时中止正在执行的任务
- **API Key 安全**: 使用 `type="password"` 输入框，不会明文显示

---

## 📝 编程接口 / Programmatic API

```typescript
import { BeeAgent } from '@bee-agent/agent-core'

// 创建 Agent / Create Agent
const agent = new BeeAgent({
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'sk-xxx',
  model: 'gpt-4',
  maxSteps: 30,           // 可选，默认 20
  temperature: 0.7,       // 可选，默认 0.7
  maxRetries: 3,          // 可选，默认 3
  timeout: 60000,         // 可选，默认 60s
  domConfig: {
    viewportExpansion: 200,         // 可选，视口扩展像素
    includeAttributes: true,        // 可选，输出包含元素属性
    blacklist: ['.ad', '#cookie'],  // 可选，跳过的选择器
  },
  onAskUser: async (question) => {  // 可选，处理 ask_user 工具
    return prompt(question) || ''
  }
})

// 监听事件 / Listen to events
agent.addEventListener('step', (e) => {
  const detail = (e as CustomEvent).detail
  console.log(`[${detail.type}] Step ${detail.stepIndex}`, detail)
})

agent.addEventListener('statuschange', (e) => {
  console.log('Status:', (e as CustomEvent).detail.status)
})

agent.addEventListener('error', (e) => {
  console.error('Error:', (e as CustomEvent).detail.error)
})

// 执行任务 / Execute task
const result = await agent.execute('点击搜索按钮并输入 TypeScript')
console.log(result.success, result.message, result.steps)

// 中止任务 / Abort task
agent.stop()

// 释放资源 / Cleanup
agent.dispose()
```

---

## 📄 License

MIT

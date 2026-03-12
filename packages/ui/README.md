# @bee-agent/ui

BeeAgent 浮动面板 UI 组件，基于 React 构建，提供任务输入、执行状态展示和配置管理界面。

## Features

- **浮动侧边栏**：悬浮图标 + 可展开侧边栏，不干扰宿主页面
- **任务交互**：输入任务指令、实时查看执行步骤、停止运行中的任务
- **配置管理**：Base URL / API Key / 模型选择，持久化到 `localStorage`
- **主题切换**：暗色/浅色主题，状态持久化
- **快捷键**：`Ctrl+Shift+B` 切换侧边栏显示
- **状态指示**：彩色状态点实时反映 Agent 状态（idle/running/completed/error）
- **事件集成**：自动监听 Agent 的 `statuschange` / `step` / `error` 事件

## Usage

```ts
import { mountBeeAgentUI } from '@bee-agent/ui'
import { BeeAgent } from '@bee-agent/agent-core'

const agent = new BeeAgent({
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'sk-xxx',
  model: 'gpt-4'
})

// 挂载 UI（返回卸载函数）
const unmount = mountBeeAgentUI(agent)

// 卸载
unmount()
```

## Components

| 组件/函数 | 说明 |
|----------|------|
| `mountBeeAgentUI(agent)` | 挂载入口，创建 Shadow DOM 容器并渲染 React 组件 |
| `BeeAgentUI` | 主 React 组件，包含侧边栏、输入框、步骤列表、设置面板 |

## UI Structure

```
悬浮图标 (FAB)
└── 侧边栏 (Sidebar)
    ├── 标题栏：BeeAgent + 状态点 + 主题/设置/关闭按钮
    ├── 消息列表：任务指令 + 执行步骤 + 结果
    ├── 输入区域：任务输入框 + 发送/停止按钮
    └── 设置面板：Base URL / API Key / 模型 / 语言
```

## Dependencies

| 包 | 说明 |
|----|------|
| `@bee-agent/agent-core` | Agent 核心（类型依赖） |
| `react` / `react-dom` | UI 框架 |

# @bee-agent/agent-core

基于 ReAct (Reasoning + Acting) 范式的浏览器自动化 Agent 核心引擎。

## Features

- **ReAct 循环**：Observe → Think → Act → Reflect 四阶段自动执行
- **事件驱动**：继承 `EventTarget`，支持 `step` / `statuschange` / `error` / `retry` 事件
- **FIFO 记忆管理**：自动维护最近 N 条执行记忆，支持跨步骤上下文传递
- **重复动作检测**：4 步窗口内检测重复操作，避免死循环
- **双模式 LLM 支持**：兼容 `tool_calls` 和 `content` JSON 两种响应格式
- **内置工具集**：10 个浏览器操作工具（click, type, scroll, hover, select, keyboard, wait, wait_for, ask_user, done）

## Usage

```ts
import { BeeAgent } from '@bee-agent/agent-core'

const agent = new BeeAgent({
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'sk-xxx',
  model: 'gpt-4',
  maxSteps: 30,       // 可选，默认 20
  temperature: 0.7,   // 可选，默认 0.7
  domConfig: {
    viewportExpansion: 200,
    includeAttributes: true,
    blacklist: ['.ad', '#cookie-banner']
  },
  onAskUser: async (question) => prompt(question) || ''
})

// 监听事件
agent.addEventListener('step', (e) => {
  const { type, stepIndex } = (e as CustomEvent).detail
  console.log(`[${type}] Step ${stepIndex}`)
})

agent.addEventListener('statuschange', (e) => {
  console.log('Status:', (e as CustomEvent).detail.status)
})

// 执行任务
const result = await agent.execute('点击搜索按钮并输入 TypeScript')
console.log(result.success, result.message, result.steps)

// 中止 / 释放
agent.stop()
agent.dispose()
```

## API

| 类/函数 | 说明 |
|---------|------|
| `BeeAgent` | 核心 Agent 类，封装 ReAct 循环 |
| `createTools(domEngine, config?)` | 创建内置工具集 |
| `AgentConfig` | Agent 配置接口 |
| `AgentStatus` | 状态类型：`idle` / `running` / `completed` / `error` |
| `AgentStep` | 单步执行记录 |
| `ExecutionResult` | 任务执行结果 |

## Dependencies

| 包 | 说明 |
|----|------|
| `@bee-agent/dom-engine` | DOM 解析与操作引擎 |
| `@bee-agent/llm-client` | LLM API 客户端 |

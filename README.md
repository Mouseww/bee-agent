# BeeAgent Web Controller

网页内嵌 AI Agent —— 用自然语言控制任意网页。

BeeQueen 集团自研项目，灵感来源于 alibaba/page-agent，完全自主实现。

## 核心能力
- 纯 JavaScript 注入，无需浏览器扩展
- 基于文本 DOM 解析，轻量高效
- 自然语言驱动网页操作
- 支持任意 OpenAI 格式 LLM API

## 架构
- `packages/dom-engine` — DOM 解析和元素交互引擎
- `packages/agent-core` — Re-Act Agent 循环
- `packages/llm-client` — LLM 接口封装
- `packages/ui` — 可嵌入式 UI 组件

## 技术栈
- TypeScript
- Vite (构建)
- React (UI 组件)

## License
MIT

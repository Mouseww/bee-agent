# @bee-agent/page-agent

BeeAgent 的 IIFE/Bookmarklet 注入版，可通过 `<script>` 标签或浏览器书签一键注入到任意网页。

## Features

- **IIFE 单文件打包**：所有依赖（含 React）打包为单个 `bee-agent.js`，CSS 内联
- **Bookmarklet 支持**：提供 `generate-bookmarklet` 脚本，一键生成书签小程序
- **全局 API**：注入后通过 `window.initBeeAgent()` 和 `window.BeeAgent` 访问
- **快捷键控制**：`Ctrl+Shift+B` 切换 Agent 开关
- **配置持久化**：通过 `localStorage` 保存和恢复配置
- **自动激活**：支持 `autoActivate` 配置项，页面加载时自动启动
- **防重复初始化**：多次调用安全，不会创建重复实例

## Usage

### Script 标签注入

```html
<script src="https://your-cdn.com/bee-agent.js"></script>
<script>
  window.initBeeAgent({
    apiKey: 'sk-xxx',
    model: 'gpt-4',                          // 可选，默认 gpt-4
    baseURL: 'https://api.openai.com/v1'     // 可选
  })
</script>
```

### Bookmarklet

```bash
# 生成 bookmarklet
pnpm --filter @bee-agent/page-agent build
pnpm --filter @bee-agent/page-agent generate-bookmarklet

# 输出: dist/bookmarklet.txt
# 复制内容 → 创建浏览器书签 → 粘贴到 URL 字段
```

### 控制台注入

```js
// 动态加载
const s = document.createElement('script')
s.src = 'https://your-cdn.com/bee-agent.js'
document.head.appendChild(s)
s.onload = () => window.initBeeAgent({ apiKey: 'sk-xxx' })
```

## Build

```bash
pnpm --filter @bee-agent/page-agent build
# 输出: dist/bee-agent.js (IIFE, minified)
```

## Dependencies

| 包 | 说明 |
|----|------|
| `@bee-agent/agent-core` | ReAct Agent 核心 |
| `@bee-agent/dom-engine` | DOM 解析/操作引擎 |
| `@bee-agent/llm-client` | LLM API 客户端 |
| `@bee-agent/ui` | 浮动面板 UI |
| `react` / `react-dom` | UI 框架（打包到 IIFE 中） |

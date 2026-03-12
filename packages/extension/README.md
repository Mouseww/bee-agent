# @bee-agent/extension

BeeAgent Chrome 浏览器扩展，通过扩展图标或快捷键一键激活浏览器自动化 Agent。

## Features

- **一键激活**：点击扩展图标或按 `Ctrl+Shift+B` 激活/关闭 Agent
- **Popup 配置界面**：可视化配置 Base URL、API Key、模型选择、界面语言
- **动态模型列表**：从 API 端点 `/v1/models` 自动拉取可用模型
- **自定义模型**：支持手动输入模型名（优先于下拉列表）
- **配置持久化**：使用 `chrome.storage.sync` 跨设备同步配置
- **自动激活**：支持配置页面加载时自动激活 Agent
- **资源清理**：页面卸载时自动释放 Agent 资源

## Structure

```
extension/
├── public/
│   ├── manifest.json    # Chrome 扩展清单（Manifest V3）
│   ├── popup.html       # Popup 配置界面
│   └── icons/           # 扩展图标
├── src/
│   ├── background.ts    # Service Worker（安装事件、图标点击、消息路由）
│   ├── content.ts       # Content Script（注入 Agent + UI 到页面）
│   └── popup.ts         # Popup 脚本（配置保存、模型获取、激活）
```

## Build

```bash
# 构建扩展
pnpm --filter @bee-agent/extension build

# 加载到 Chrome
# 1. 打开 chrome://extensions/
# 2. 启用开发者模式
# 3. 加载已解压的扩展 → 选择 packages/extension/dist
```

## Dependencies

| 包 | 说明 |
|----|------|
| `@bee-agent/agent-core` | ReAct Agent 核心 |
| `@bee-agent/dom-engine` | DOM 解析/操作引擎 |
| `@bee-agent/llm-client` | LLM API 客户端 |
| `@bee-agent/ui` | 浮动面板 UI |

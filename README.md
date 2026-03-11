# 🐝 BeeAgent Web Controller

网页内嵌 AI Agent —— 用自然语言控制任意网页。

BeeQueen 集团自研项目，灵感来源于 alibaba/page-agent，完全自主实现。

## ✨ 核心能力

- 🤖 **智能Agent**: 基于ReAct框架的自主决策能力
- 🎯 **DOM操作**: 精确的元素定位、高亮和交互
- 💬 **自然语言**: 用中文或英文描述任务即可
- 🎨 **现代UI**: 可拖拽、折叠、深色模式的浮动面板
- 📊 **步骤可视化**: 实时查看Agent的思考和执行过程
- 🔧 **多种使用方式**: Chrome扩展、Bookmarklet、直接注入

## 📦 项目架构

```
bee-agent/
├── packages/
│   ├── dom-engine/      # DOM操作引擎 (highlight/parser/actions)
│   ├── agent-core/      # Agent核心 (ReAct循环/工具/反思)
│   ├── llm-client/      # LLM客户端 (OpenAI/Claude)
│   ├── ui/              # React UI组件 (拖拽/主题/设置)
│   ├── extension/       # Chrome扩展 (Manifest V3)
│   └── page-agent/      # IIFE构建 (Bookmarklet)
└── package.json
```

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 构建所有包

```bash
npm run build
```

### 开发模式

```bash
npm run dev
```

## 📱 使用方式

### 1. Chrome扩展

```bash
cd packages/extension
npm run build
```

在Chrome中加载：
1. 打开 `chrome://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `packages/extension/dist` 目录

配置并激活：
- 点击扩展图标配置API Key
- 点击"激活"或按 `Ctrl+Shift+B`

### 2. Bookmarklet

```bash
cd packages/page-agent
npm run build
npm run generate-bookmarklet
```

创建书签：
1. 复制 `dist/bookmarklet.txt` 中的内容
2. 在浏览器中创建新书签
3. 将内容粘贴到书签的URL字段
4. 访问任意网页，点击书签激活

### 3. 直接注入

```html
<script src="https://your-cdn.com/bee-agent.js"></script>
<script>
  window.initBeeAgent({
    apiKey: 'your-api-key',
    model: 'gpt-4',
    language: 'zh-CN'
  });
</script>
```

## 🎮 使用示例

```
"点击登录按钮"
"填写用户名为admin"
"滚动到页面底部"
"查找所有商品价格"
```

## 🎨 UI功能

- **拖拽移动**: 按住标题栏拖动面板
- **折叠/展开**: 点击 ▼/▲ 按钮
- **主题切换**: 点击 🌙/☀️ 切换深色/浅色模式
- **设置面板**: 点击 ⚙️ 配置API Key和模型
- **快捷键**: `Ctrl+Shift+B` 打开/关闭面板
- **Markdown渲染**: 支持粗体、斜体、代码块
- **步骤时间线**: 可视化展示每步的observe/think/act

## 🛠️ 技术栈

- **TypeScript**: 类型安全
- **React**: UI框架
- **Vite**: 构建工具
- **Monorepo**: 多包管理

## 📝 架构设计

```
┌─────────────────────────────────────┐
│           BeeAgent UI               │
│  (React浮动面板、消息、步骤可视化)    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         BeeAgent Core               │
│  (ReAct循环、工具调用、反思机制)      │
└──────┬───────────────────┬──────────┘
       │                   │
┌──────▼──────┐    ┌──────▼──────────┐
│ DOM Engine  │    │  LLM Client     │
│ (元素定位)   │    │  (API调用)      │
└─────────────┘    └─────────────────┘
```

## 📄 License

MIT

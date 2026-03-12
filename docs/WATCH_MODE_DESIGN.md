# BeeAgent Watch Mode（监听模式）— 架构设计文档

> 版本: Draft v1.0 | 日期: 2026-03-12 | 作者: Alex (CTO)

---

## 一、核心目标

让 BeeAgent 从「一次性任务执行器」升级为「持续性页面代理」，支持两种核心场景：

1. **页面监听 + 自动响应**：持续监控页面变化，满足条件时自动执行操作
2. **对话接管**：在聊天页面（微信网页版、Telegram Web、客服系统等）中代替用户自动回复

---

## 二、当前架构分析

### 现有模块（7633+ 行 TypeScript）
```
packages/
├── dom-engine/     # DOM 解析 + 操作（1282 行）
├── agent-core/     # ReAct 循环（~640 行）
├── llm-client/     # LLM API 调用（~293 行）
├── ui/             # 悬浮图标 + 侧边栏 UI（~1322 行）
├── extension/      # Chrome 扩展 Manifest V3
└── page-agent/     # IIFE 注入入口
```

### 现有执行模式
```
用户输入任务 → agent.execute(task)
  ↓
  for (step in maxSteps):
    Observe(DOM 快照) → Think(LLM 决策) → Act(工具执行) → Reflect(反思)
  ↓
  完成/出错/达到步数上限 → 返回 ExecutionResult
```

**核心限制：execute() 是一次性的，跑完就停。**

---

## 三、Watch Mode 整体架构

### 3.1 新增执行模式对比

| 维度 | Task Mode（现有） | Watch Mode（新增） |
|------|-------------------|-------------------|
| 生命周期 | 有限步骤，完成即停 | 持续运行，直到用户停止 |
| 触发方式 | 用户主动输入任务 | 页面变化 / 定时轮询 / 特定事件 |
| LLM 调用频率 | 每步必调 | 仅检测到变化时调用 |
| 上下文 | 单次任务上下文 | 跨轮次累积上下文（滑动窗口） |
| 消耗 | 可预测（maxSteps 限制） | 需限制（每分钟/每小时 LLM 调用次数） |

### 3.2 分层架构

```
┌─────────────────────────────────────────┐
│              UI Layer (ui/)             │
│  Watch Mode Panel: 规则配置/状态/日志    │
└────────────────┬────────────────────────┘
                 │
┌────────────────┴────────────────────────┐
│         WatchEngine (新增)              │
│  ├── ChangeDetector   页面变化检测       │
│  ├── TriggerEvaluator 触发条件评估       │
│  ├── ActionExecutor   动作执行（复用工具）│
│  └── SessionMemory    跨轮次记忆         │
└────────────────┬────────────────────────┘
                 │
┌────────────────┴────────────────────────┐
│  agent-core / dom-engine / llm-client   │
│         （现有模块，最小改动）              │
└─────────────────────────────────────────┘
```

---

## 四、核心模块设计

### 4.1 WatchEngine — 监听引擎

```typescript
interface WatchConfig {
  /** 监听规则 */
  rules: WatchRule[]
  /** DOM 变化检测间隔（毫秒），默认 2000 */
  pollInterval: number
  /** LLM 调用频率限制：每分钟最大调用次数 */
  maxLLMCallsPerMinute: number
  /** 每小时最大 LLM 调用次数（成本保护） */
  maxLLMCallsPerHour: number
  /** 每次 LLM 调用最大 token 限制 */
  maxTokensPerCall: number
  /** 上下文窗口：保留最近 N 轮交互记录 */
  contextWindowSize: number
  /** 是否启用静默模式（不弹通知） */
  silent: boolean
}

interface WatchRule {
  /** 规则 ID */
  id: string
  /** 规则名称（用户可读） */
  name: string
  /** 触发类型 */
  trigger: WatchTrigger
  /** LLM 指令：检测到变化时交给 LLM 的 prompt */
  instruction: string
  /** 是否启用 */
  enabled: boolean
  /** 可选：仅在特定时间段内生效 */
  activeHours?: { start: string; end: string }
  /** 可选：冷却时间（同一规则两次触发间的最小间隔，秒） */
  cooldownSeconds?: number
}
```

### 4.2 WatchTrigger — 触发器类型

```typescript
type WatchTrigger =
  | DOMChangeTrigger     // DOM 变化
  | IntervalTrigger      // 定时轮询
  | NewMessageTrigger    // 新消息（聊天场景）
  | URLChangeTrigger     // URL 变化
  | ElementAppearTrigger // 特定元素出现/消失
  | CustomEventTrigger   // 自定义 JS 事件

interface DOMChangeTrigger {
  type: 'dom_change'
  /** 监控区域的 CSS 选择器（不指定则全页面） */
  selector?: string
  /** 变化类型过滤 */
  changeTypes: ('added' | 'removed' | 'text' | 'attribute')[]
  /** 最小变化量（避免微小变化触发） */
  minChanges?: number
}

interface NewMessageTrigger {
  type: 'new_message'
  /** 消息容器选择器 */
  containerSelector: string
  /** 单条消息选择器 */
  messageSelector: string
  /** 发送者选择器（排除自己的消息） */
  senderSelector?: string
  /** 自己的标识（用于排除自己发的消息） */
  selfIdentifier?: string
}

interface IntervalTrigger {
  type: 'interval'
  /** 间隔秒数 */
  seconds: number
}

interface ElementAppearTrigger {
  type: 'element_appear'
  /** 等待出现的元素选择器 */
  selector: string
  /** 是否监控消失（默认监控出现） */
  waitForRemoval?: boolean
}

interface URLChangeTrigger {
  type: 'url_change'
  /** URL 模式匹配（正则） */
  pattern?: string
}

interface CustomEventTrigger {
  type: 'custom_event'
  /** 事件名 */
  eventName: string
}
```

### 4.3 ChangeDetector — 变化检测器

```typescript
class ChangeDetector {
  private observer: MutationObserver | null = null
  private lastSnapshot: string = ''
  private changeBuffer: PageChange[] = []

  /**
   * 基于 MutationObserver 的实时检测（高效，不消耗 LLM）
   * 仅当检测到有意义的变化时，才触发 LLM 分析
   */
  startObserving(selector?: string): void

  /**
   * 快照对比法：适用于定时轮询场景
   * 对比两次 DOM 快照的差异
   */
  compareSnapshots(oldSnapshot: string, newSnapshot: string): PageChange[]

  /**
   * 聊天消息专用检测：监控消息容器
   * 返回新增消息列表（排除自己发送的）
   */
  detectNewMessages(config: NewMessageTrigger): NewMessage[]
}

interface PageChange {
  type: 'added' | 'removed' | 'text_changed' | 'attribute_changed'
  selector: string
  oldValue?: string
  newValue?: string
  element?: Element
  timestamp: number
}

interface NewMessage {
  text: string
  sender: string
  timestamp: number
  element: Element
  isFromSelf: boolean
}
```

### 4.4 SessionMemory — 跨轮次记忆

```typescript
class SessionMemory {
  private interactions: InteractionRecord[] = []
  private maxRecords: number

  /**
   * 滑动窗口记忆
   * 保留最近 N 轮交互，超出自动淘汰最旧的
   */
  addInteraction(record: InteractionRecord): void

  /**
   * 构建给 LLM 的上下文
   * 将历史交互序列化为 prompt 片段
   */
  buildContext(): string

  /**
   * 摘要压缩（可选）
   * 当记忆过多时，调用 LLM 做一次摘要压缩
   */
  async summarize(llmClient: LLMClient): Promise<void>
}

interface InteractionRecord {
  timestamp: number
  trigger: string        // 什么触发的
  observation: string    // 看到了什么
  decision: string       // LLM 决定做什么
  action: string         // 执行了什么
  result: string         // 结果如何
}
```

### 4.5 成本控制 — RateLimiter

```typescript
class RateLimiter {
  private callTimestamps: number[] = []

  /**
   * 检查是否可以调用 LLM
   * 基于滑动窗口计数器
   */
  canCall(): boolean

  /**
   * 记录一次调用
   */
  recordCall(): void

  /**
   * 获取当前使用统计
   */
  getStats(): {
    callsLastMinute: number
    callsLastHour: number
    estimatedCostUSD: number
  }
}
```

---

## 五、执行流程

### 5.1 Watch Mode 主循环

```
用户配置规则 → watchEngine.start(rules)
  ↓
  ┌──────────────────────────────────┐
  │  Loop (直到 stop() 被调用):       │
  │                                  │
  │  1. ChangeDetector 检测变化       │
  │     ├── MutationObserver 回调     │
  │     ├── 或 定时快照对比           │
  │     └── 或 消息容器监控           │
  │                                  │
  │  2. TriggerEvaluator 评估规则     │
  │     ├── 匹配触发条件？            │
  │     ├── 冷却时间内？跳过          │
  │     └── 频率限制内？排队          │
  │                                  │
  │  3. 构建 LLM Prompt              │
  │     ├── 规则指令                  │
  │     ├── 变化内容                  │
  │     ├── 当前 DOM 状态             │
  │     └── SessionMemory 上下文      │
  │                                  │
  │  4. LLM 决策                     │
  │     ├── 需要执行操作？→ 执行工具   │
  │     ├── 不需要操作？→ 记录并跳过   │
  │     └── 需要通知用户？→ UI 提示    │
  │                                  │
  │  5. 记录到 SessionMemory          │
  │  6. 通知 UI 更新日志              │
  └──────────────────────────────────┘
```

### 5.2 聊天自动回复流程（重点场景）

```
配置:
  trigger: new_message
  containerSelector: '.chat-messages'
  messageSelector: '.message-item'
  senderSelector: '.message-sender'
  selfIdentifier: '我'
  instruction: "你是客服助理，根据以下知识库回答用户问题..."

执行流程:
  1. MutationObserver 监控 .chat-messages
  2. 新 DOM 节点插入 → 提取消息文本和发送者
  3. 过滤：排除自己发的消息
  4. 构建 Prompt:
     - System: 角色设定 + 知识库
     - 历史: 最近 N 轮对话（从 SessionMemory）
     - User: "用户发来新消息: {消息内容}"
  5. LLM 返回回复文本
  6. 执行操作:
     a. 找到输入框 → type(index, 回复文本)
     b. 找到发送按钮 → click(index)
     c. 或 keyboard(index, 'Enter')
  7. 记录交互到 SessionMemory
  8. 等待下一条消息
```

---

## 六、UI 设计

### 6.1 侧边栏新增 Watch Tab

现有侧边栏底部增加 Tab 切换：**💬 Chat** | **👁️ Watch**

### 6.2 Watch 面板布局

```
┌─────────────────────────────────┐
│  👁️ Watch Mode                  │
│  ○ 未启动 / ● 监听中 / ⚠️ 暂停   │
├─────────────────────────────────┤
│                                 │
│  📋 规则列表                     │
│  ┌─────────────────────────┐   │
│  │ ☑ 自动回复客户消息        │   │
│  │   trigger: new_message   │   │
│  │   状态: 已触发 12 次      │   │
│  │   [编辑] [暂停]          │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ ☑ 监控价格变化            │   │
│  │   trigger: dom_change    │   │
│  │   状态: 等待触发          │   │
│  │   [编辑] [暂停]          │   │
│  └─────────────────────────┘   │
│                                 │
│  [+ 添加规则]                   │
│                                 │
├─────────────────────────────────┤
│  📊 统计                        │
│  LLM 调用: 23/60 (每小时)       │
│  预估费用: $0.15                │
│  运行时长: 2h 15m               │
├─────────────────────────────────┤
│  📜 日志 (最近)                  │
│  11:23 ✅ 回复了用户"价格多少"    │
│  11:20 ⏭ 跳过自己的消息          │
│  11:18 ✅ 回复了用户"你好"        │
│                                 │
├─────────────────────────────────┤
│  [▶ 启动] [⏹ 停止] [⚙ 设置]     │
└─────────────────────────────────┘
```

### 6.3 规则编辑器（弹出面板）

```
┌──────────────────────────────────┐
│  编辑规则                         │
├──────────────────────────────────┤
│  名称: [自动回复客户消息        ] │
│                                  │
│  触发类型: [新消息 ▾]            │
│                                  │
│  消息容器: [.chat-messages      ] │
│  消息选择器: [.msg-item         ] │
│  发送者选择器: [.msg-sender     ] │
│  排除自己: [我的昵称            ] │
│                                  │
│  AI 指令:                        │
│  ┌──────────────────────────┐   │
│  │ 你是客服助理。          │   │
│  │ 回答要简洁专业。        │   │
│  │ 不确定的问题回复"请     │   │
│  │ 稍等，我转接人工"。     │   │
│  └──────────────────────────┘   │
│                                  │
│  冷却时间: [5] 秒                │
│                                  │
│  [保存] [取消]                   │
└──────────────────────────────────┘
```

### 6.4 快捷模板（一键配置）

提供预设模板降低配置门槛：

| 模板 | 触发器 | 适用场景 |
|------|--------|---------|
| 💬 聊天自动回复 | new_message | 微信/Telegram/客服系统 |
| 📦 商品监控 | dom_change | 电商价格/库存变化 |
| 📋 表单自动填写 | element_appear | 重复性表单 |
| 🔄 定时刷新检查 | interval | 抢票/秒杀/监控 |
| 🔔 页面通知 | dom_change | 不操作只通知用户 |

---

## 七、改动范围评估

### 7.1 新增文件

```
packages/agent-core/src/
├── watch/
│   ├── WatchEngine.ts         ~300 行  # 监听引擎主类
│   ├── ChangeDetector.ts      ~250 行  # 变化检测（MutationObserver + 快照）
│   ├── TriggerEvaluator.ts    ~150 行  # 触发条件评估
│   ├── SessionMemory.ts       ~120 行  # 跨轮次记忆
│   ├── RateLimiter.ts         ~80 行   # 频率限制
│   ├── types.ts               ~100 行  # Watch 相关类型
│   └── presets.ts             ~80 行   # 预设模板
└── watch/index.ts             ~10 行   # 导出

packages/ui/src/
├── WatchPanel.tsx             ~400 行  # Watch UI 面板
└── RuleEditor.tsx             ~250 行  # 规则编辑器

预计新增: ~1740 行
```

### 7.2 修改文件

| 文件 | 改动 | 行数 |
|------|------|------|
| `agent-core/src/index.ts` | 导出 WatchEngine | +5 |
| `agent-core/src/types.ts` | 新增 Watch 类型 | +20 |
| `ui/src/BeeAgentUI.tsx` | 添加 Watch Tab + 面板切换 | +30 |
| `page-agent/src/index.ts` | 暴露 watchEngine 到全局 | +15 |
| `extension/src/content.ts` | 支持 Watch Mode 持久化 | +20 |

### 7.3 不动的部分

- `dom-engine/` — 完全复用，零改动
- `llm-client/` — 完全复用，零改动
- `agent-core/src/tools.ts` — 完全复用
- `agent-core/src/agent.ts` — Watch 引擎独立，不影响现有 ReAct 循环

---

## 八、风险点与应对

| 风险 | 影响 | 应对方案 |
|------|------|---------|
| LLM 费用爆炸 | 持续调用导致高额费用 | RateLimiter 强制限制 + UI 实时费用估算 + 每小时上限 |
| 误操作 | 自动回复错误内容 | 可选「确认模式」：LLM 决策后等用户确认再执行 |
| 页面结构变化 | 选择器失效 | 检测到选择器匹配失败时自动暂停并通知 |
| 内存泄漏 | MutationObserver 长时间运行 | 定期清理 changeBuffer + 限制 SessionMemory 大小 |
| 多 Tab 冲突 | 同一页面多个 Watch 实例 | 使用 BroadcastChannel 协调，只允许一个活跃实例 |
| 对话上下文过长 | token 数膨胀 | 滑动窗口 + 可选 LLM 摘要压缩 |

---

## 九、实现优先级（分阶段）

### Phase 1: 核心引擎（MVP）
- WatchEngine + ChangeDetector + TriggerEvaluator
- 支持 `new_message` 和 `dom_change` 两种触发器
- RateLimiter 基础限流
- UI: Watch Tab + 简单日志面板
- **预计工作量: 2-3 个 Claude Code session**

### Phase 2: 完善体验
- SessionMemory 跨轮次记忆
- 规则编辑器 UI
- 预设模板（聊天回复、价格监控等）
- 确认模式（可选）
- **预计工作量: 2 个 session**

### Phase 3: 高级特性
- URL/自定义事件触发器
- LLM 摘要压缩
- 多 Tab 协调（BroadcastChannel）
- 执行回放/撤销
- 规则导入/导出
- **预计工作量: 2-3 个 session**

---

## 十、API 使用示例

### 10.1 编程式（IIFE 注入）

```javascript
// 注入 bee-agent.js 后
const engine = new BeeAgent.WatchEngine({
  apiKey: 'sk-xxx',
  baseURL: 'https://api.example.com/v1',
  model: 'gpt-4'
})

// 自动回复微信消息
engine.addRule({
  name: '微信自动回复',
  trigger: {
    type: 'new_message',
    containerSelector: '.chat-messages',
    messageSelector: '.message',
    senderSelector: '.sender-name',
    selfIdentifier: '我的昵称'
  },
  instruction: `你是一个友善的助理。收到消息后用中文简洁回复。
    如果是问价格，回复"请查看价目表"。
    如果不确定，回复"稍等，我确认一下"。`
})

engine.start()

// 停止
engine.stop()

// 查看统计
console.log(engine.getStats())
```

### 10.2 Chrome 扩展 UI

用户通过侧边栏 Watch 面板可视化配置，无需写代码。

---

## 十一、总结

监听模式是 BeeAgent 从「工具」到「代理」的关键升级。架构上做到：

1. **最小侵入**：不改现有 ReAct 核心，新增独立 WatchEngine
2. **复用最大化**：DOM 操作、LLM 调用、工具系统全部复用
3. **成本可控**：RateLimiter + 费用估算 + 冷却时间
4. **渐进式实现**：Phase 1 就能跑通聊天自动回复场景

等确认后，Phase 1 可以立即开工。

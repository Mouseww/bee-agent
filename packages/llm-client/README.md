# @bee-agent/llm-client

OpenAI 兼容的 LLM API 客户端，支持多种 LLM 提供商（OpenAI、Azure、Deepseek、通义千问等）。

## Features

- **OpenAI 兼容**：完全遵循 OpenAI Chat Completion API 规范
- **自动重试**：指数退避 + 随机抖动，可配置重试次数（1-10）
- **流式支持**：`AsyncGenerator` 模式处理 SSE 数据流
- **超时控制**：可配置请求超时（最小 5 秒）
- **请求中止**：支持 `AbortSignal` 优雅中止
- **事件驱动**：基于 `EventTarget`，支持 `retry` / `error` 事件
- **错误分类**：区分可重试（429/500/502/503/504）和不可重试（400/401/403/404）错误
- **Function Calling**：完整支持 OpenAI Tool/Function 调用格式

## Usage

```ts
import { LLMClient } from '@bee-agent/llm-client'

const client = new LLMClient({
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'sk-xxx',
  model: 'gpt-4',
  temperature: 0.7,   // 可选，默认 0.7
  maxRetries: 3,       // 可选，默认 3
  timeout: 60000,      // 可选，默认 60s
  maxTokens: 4096      // 可选
})

// 非流式调用
const result = await client.invoke([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello!' }
])
console.log(result.content)
console.log(result.toolCalls)
console.log(result.usage)

// 带工具调用
const result2 = await client.invoke(messages, [
  {
    type: 'function',
    function: {
      name: 'search',
      description: 'Search the web',
      parameters: { type: 'object', properties: { query: { type: 'string' } } }
    }
  }
])

// 流式调用
for await (const chunk of client.invokeStream(messages)) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '')
}

// 监听重试事件
client.addEventListener('retry', (e) => {
  const { attempt, maxAttempts } = (e as CustomEvent).detail
  console.log(`Retrying ${attempt}/${maxAttempts}...`)
})

// 释放
client.dispose()
```

## API

| 导出 | 说明 |
|------|------|
| `LLMClient` | 核心客户端类 |
| `LLMApiError` | API 错误类（含 statusCode、retryable） |
| `LLMConfig` | 客户端配置接口 |
| `Message` | 消息结构（system/user/assistant/tool） |
| `Tool` / `ToolCall` | 工具定义与调用结构 |
| `InvokeResult` | 归一化调用结果 |
| `StreamChunk` | 流式响应块 |

## Dependencies

无内部包依赖（独立底层包）。

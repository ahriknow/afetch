# SSE（Server-Sent Events）

[← 返回 README](../../README_zh-CN.md)

SSE 模块提供一个类型安全的 Server-Sent Events 客户端，配备独立的插件系统。它是一个独立的子模块，不影响核心 `afetch` 的打包体积——仅在需要 SSE 功能时导入。

```typescript
import { createSSE } from '@ahriknow/afetch/sse';
```

## 快速开始

```typescript
import { createSSE } from '@ahriknow/afetch/sse';

const sse = createSSE('https://api.example.com/events');

// 监听消息
sse.use({
    name: 'logger',
    install(api) {
        api.addHook('message', ({ event }) => {
            console.log(`[${event.event || 'message'}]`, event.data);
        });
    },
});

sse.connect();
```

## 配置

```typescript
const sse = createSSE('/events', {
    baseURL: 'https://api.example.com',
    headers: { Authorization: 'Bearer token' },
    params: { stream: 'true' },
    autoReconnect: true,
    maxReconnectAttempts: 10,
    reconnectDelay: 3000,
    // 或使用函数实现指数退避：
    // reconnectDelay: (attempt) => Math.pow(2, attempt) * 1000,
    fetchAdapter: customFetch,
    plugins: [createAutoReconnectPlugin()],
    meta: { source: 'dashboard' },
});
```

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|--------|------|---------|------|
| `baseURL` | `string` | — | 基础 URL，会拼接到相对 URL 前面 |
| `headers` | `Record<string, string>` | `{ Accept: 'text/event-stream', 'Cache-Control': 'no-cache' }` | 自定义 HTTP 请求头 |
| `params` | `Record<string, string \| number \| boolean \| null \| undefined>` | — | 查询参数（null/undefined 值会被省略） |
| `autoReconnect` | `boolean` | `true` | 是否启用自动重连 |
| `maxReconnectAttempts` | `number` | `Infinity` | 最大重连次数 |
| `reconnectDelay` | `number \| (attempt: number) => number` | `3000` | 重连间隔（毫秒），可以是固定数值或函数 |
| `fetchAdapter` | `typeof fetch` | `globalThis.fetch` | 自定义 fetch 实现 |
| `plugins` | `SSEPlugin[]` | — | 创建时安装的插件列表 |
| `meta` | `Record<string, unknown>` | — | 供插件使用的自定义元数据 |

## 客户端 API

### `sse.connect()`

打开 SSE 连接。如果已经连接，则无操作。

```typescript
sse.connect();
```

### `sse.close()`

关闭连接并停止所有待执行的重连。触发 `close` 钩子。

```typescript
sse.close();
```

### `sse.use(plugin)`

安装插件。同名插件只会安装一次。

```typescript
sse.use(myPlugin);
```

### 只读属性

| 属性 | 类型 | 说明 |
|----------|------|------|
| `sse.state` | `SSEState` | 当前连接状态：`CONNECTING`、`OPEN` 或 `CLOSED` |
| `sse.url` | `string` | 当前连接的完整 URL |
| `sse.reconnectCount` | `number` | 成功重连的次数 |
| `sse.defaults` | `SSEConfig` | 当前配置（只读） |

## 状态管理

SSE 客户端管理三种状态：

```typescript
import { SSEState } from '@ahriknow/afetch/sse';

console.log(sse.state); // SSEState.CLOSED
sse.connect();          // → SSEState.CONNECTING → SSEState.OPEN
sse.close();            // → SSEState.CLOSED
```

- `CLOSED` — 未连接（初始状态，或调用 `close()` 之后）
- `CONNECTING` — 正在建立连接
- `OPEN` — 连接已建立，正在接收事件

## 错误处理

SSE 模块抛出 `SSEError` 实例：

```typescript
import { SSEError, SSEErrorType } from '@ahriknow/afetch/sse';

sse.use({
    name: 'error-handler',
    install(api) {
        api.addHook('error', ({ error, attempt, config }) => {
            if (error.isNetworkError) {
                console.log(`网络错误，第 ${attempt + 1} 次尝试`);
            }
            if (error.isConfigError) {
                console.error('配置无效:', error.message);
                return false; // 阻止重连
            }
            // 返回 void/undefined 允许继续重连
        });
    },
});
```

### 错误类型

| 代码 | 说明 |
|------|------|
| `SSEErrorType.NETWORK` | 网络或 HTTP 错误（非 OK 状态码、fetch 失败、中断） |
| `SSEErrorType.PARSE` | SSE 数据解析错误 |
| `SSEErrorType.TIMEOUT` | 连接超时 |
| `SSEErrorType.CONFIG` | 配置错误（如缺少 URL） |

### `SSEError` 属性

| 属性 | 类型 | 说明 |
|----------|------|------|
| `code` | `SSEErrorType` | 错误类型代码 |
| `config` | `SSEConfig` | 发生错误时的配置 |
| `cause` | `Error \| undefined` | 引发此错误的原始错误 |
| `isNetworkError` | `boolean` | `code === SSEErrorType.NETWORK` 的快捷方式 |
| `isParseError` | `boolean` | `code === SSEErrorType.PARSE` 的快捷方式 |
| `isTimeout` | `boolean` | `code === SSEErrorType.TIMEOUT` 的快捷方式 |
| `isConfigError` | `boolean` | `code === SSEErrorType.CONFIG` 的快捷方式 |

## 插件系统

SSE 模块拥有独立的插件系统，与核心 `afetch` 插件系统互不干扰。

### 插件接口

```typescript
import type { SSEPlugin } from '@ahriknow/afetch/sse';

const myPlugin: SSEPlugin = {
    name: 'my-plugin',
    install(api) {
        api.addHook('connect', (ctx) => { /* ... */ });
        api.addHook('message', (ctx) => { /* ... */ });
        api.addHook('error', (ctx) => { /* ... */ });
        api.addHook('close', (ctx) => { /* ... */ });
    },
};
```

### 钩子上下文

| 钩子 | 上下文 | 说明 |
|------|---------|------|
| `connect` | `{ config, url }` | 连接建立时触发 |
| `message` | `{ config, event }` | 收到每个 SSE 事件时触发 |
| `error` | `{ config, error, attempt }` | 发生错误时触发；返回 `false` 可阻止重连 |
| `close` | `{ config, reconnectCount }` | 连接最终关闭时触发 |

### SSE 事件结构

```typescript
interface SSEEvent {
    event?: string;   // 事件类型（默认: 'message'）
    data: string;     // 事件数据
    id?: string;      // 最后的事件 ID
    retry?: number;   // 重连时间（毫秒）
}
```

## 自动重连插件

内置的重连行为控制插件：

```typescript
import { createAutoReconnectPlugin } from '@ahriknow/afetch/sse';

sse.use(createAutoReconnectPlugin({
    maxAttempts: 5,
    delay: 2000,
    shouldReconnect: (ctx) => {
        // 遇到 401/403 不重连
        if (ctx.error.cause instanceof Response) {
            return ctx.error.cause.status !== 401
                && ctx.error.cause.status !== 403;
        }
        return true;
    },
}));
```

### 选项

| 选项 | 类型 | 默认值 | 说明 |
|--------|------|---------|------|
| `maxAttempts` | `number` | `undefined` | 最大重连次数 |
| `delay` | `number \| (attempt: number) => number` | `undefined` | 自定义重连间隔 |
| `shouldReconnect` | `(ctx: SSEErrorContext) => boolean` | `undefined` | 自定义重连判断函数 |

## 自定义插件

### 日志插件

```typescript
sse.use({
    name: 'sse-logger',
    install(api) {
        api.addHook('connect', ({ url }) => {
            console.log(`[SSE] 已连接到 ${url}`);
        });
        api.addHook('message', ({ event }) => {
            console.log(`[SSE] ${event.event || 'message'}:`, event.data);
        });
        api.addHook('error', ({ error, attempt }) => {
            console.error(`[SSE] 错误（第 ${attempt + 1} 次尝试）:`, error.message);
        });
        api.addHook('close', ({ reconnectCount }) => {
            console.log(`[SSE] 已关闭（重连了 ${reconnectCount} 次）`);
        });
    },
});
```

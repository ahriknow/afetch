# WebSocket

[← 返回 README](../../README_zh-CN.md)

WebSocket 模块提供类型安全的 WebSocket 客户端，配备插件系统。它是一个独立的子模块，不会影响核心 `afetch` 包——仅在需要 WebSocket 功能时导入。

```typescript
import { createWS } from '@ahriknow/afetch/ws';
```

## 快速开始

```typescript
import { createWS } from '@ahriknow/afetch/ws';

const ws = createWS('wss://api.example.com/ws');

// 监听消息
ws.use({
    name: 'logger',
    install(api) {
        api.addHook('open', ({ url }) => {
            console.log(`已连接到 ${url}`);
        });
        api.addHook('message', ({ message }) => {
            console.log('收到:', message.data);
        });
        api.addHook('close', ({ code, reason }) => {
            console.log(`已关闭: ${code} ${reason}`);
        });
    },
});

ws.connect();

// 发送消息
ws.send({ type: 'ping' });
ws.send('你好服务器');
```

## 配置

```typescript
const ws = createWS('/ws', {
    baseURL: 'wss://api.example.com',
    protocols: ['chat', 'v1'],
    autoReconnect: true,
    maxReconnectAttempts: 10,
    reconnectDelay: 3000,
    // 或使用函数实现指数退避：
    // reconnectDelay: (attempt) => Math.pow(2, attempt) * 1000,
    params: { token: 'abc123' },
    autoParse: true,
    timeout: 10000,
    heartbeatInterval: 30000,
    heartbeatMessage: 'ping',
    binaryType: 'arraybuffer',
    plugins: [createAutoReconnectPlugin()],
    meta: { source: 'dashboard' },
});
```

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|--------|------|---------|------|
| `baseURL` | `string` | — | 相对 URL 的基础 URL |
| `protocols` | `string \| string[]` | — | WebSocket 子协议 |
| `autoReconnect` | `boolean` | `true` | 异常关闭时启用自动重连 |
| `maxReconnectAttempts` | `number` | `Infinity` | 最大重连次数 |
| `reconnectDelay` | `number \| (attempt: number) => number` | `1000` | 重连间隔（毫秒），可以是固定数字或函数 |
| `params` | `Record<string, string \| number \| boolean \| null \| undefined>` | — | 追加到 URL 的查询参数（null/undefined 值会被省略） |
| `autoParse` | `boolean` | `false` | 自动解析 JSON 消息并序列化发送的对象 |
| `timeout` | `number` | `10000` | 连接超时（毫秒） |
| `heartbeatInterval` | `number` | `0` | 心跳间隔（毫秒，0 = 禁用） |
| `heartbeatMessage` | `string \| (() => string \| ArrayBuffer \| Blob)` | — | 心跳消息内容 |
| `binaryType` | `BinaryType` | `'blob'` | WebSocket 的二进制类型（`'blob'` 或 `'arraybuffer'`） |
| `webSocketImpl` | `typeof WebSocket` | `globalThis.WebSocket` | 自定义 WebSocket 实现（用于测试/模拟） |
| `plugins` | `WSPlugin[]` | — | 创建时安装的插件 |
| `meta` | `Record<string, unknown>` | — | 插件的任意元数据 |

## 客户端 API

### `ws.connect()`

打开 WebSocket 连接。如果已经连接或正在连接，此方法无操作。

```typescript
ws.connect();
```

### `ws.close(code?, reason?)`

关闭 WebSocket 连接并停止所有待处理的重连。触发 `close` 钩子。

```typescript
ws.close();                              // 默认关闭
ws.close(1000, '正常关闭');               // 带状态码和原因
```

### `ws.send(data)`

通过 WebSocket 发送数据。如果启用了 `autoParse`，对象会自动序列化为 JSON。发送前触发 `send` 钩子。

```typescript
ws.send('你好');                               // 发送字符串
ws.send(new Uint8Array([1, 2, 3]).buffer);     // 发送二进制
ws.send({ type: 'greeting', text: 'Hi' });     // 发送对象（autoParse）
```

### `ws.use(plugin)`

安装插件。同名插件只会安装一次。

```typescript
ws.use(myPlugin);
```

### 只读属性

| 属性 | 类型 | 说明 |
|----------|------|------|
| `ws.state` | `WSState` | 当前连接状态：`CLOSED`、`CONNECTING`、`OPEN`、`CLOSING` |
| `ws.url` | `string` | 连接的完整 URL |
| `ws.reconnectCount` | `number` | 成功重连的次数 |
| `ws.defaults` | `WSConfig` | 当前配置（只读） |

## 状态管理

WebSocket 客户端管理四种状态：

```typescript
import { WSState } from '@ahriknow/afetch/ws';

console.log(ws.state); // WSState.CLOSED
ws.connect();          // → WSState.CONNECTING → WSState.OPEN
ws.close();            // → WSState.CLOSING → WSState.CLOSED
```

- `CLOSED` — 未连接（初始状态，或 `close()` 之后）
- `CONNECTING` — 正在建立连接
- `OPEN` — 连接已建立，可以发送/接收
- `CLOSING` — 连接正在关闭

## 错误处理

WebSocket 模块抛出 `WSError` 实例：

```typescript
import { WSError, WSErrorType } from '@ahriknow/afetch/ws';

ws.use({
    name: 'error-handler',
    install(api) {
        api.addHook('error', ({ error, attempt, config }) => {
            if (error.isNetworkError) {
                console.log(`第 ${attempt + 1} 次尝试时发生网络错误`);
            }
            if (error.isConfigError) {
                console.error('无效配置:', error.message);
                return false; // 阻止重连
            }
            if (error.isTimeout) {
                console.warn('连接超时');
            }
            // 返回 void/undefined 允许重连
        });
    },
});
```

### 错误类型

| 代码 | 说明 |
|------|------|
| `WSErrorType.NETWORK` | 连接失败或丢失（WebSocket 错误、异常关闭） |
| `WSErrorType.PARSE` | 消息解析或序列化错误 |
| `WSErrorType.TIMEOUT` | 连接或发送超时 |
| `WSErrorType.CONFIG` | 配置错误（如无效 URL） |

### `WSError` 属性

| 属性 | 类型 | 说明 |
|----------|------|------|
| `code` | `WSErrorType` | 错误类型代码 |
| `config` | `WSConfig` | 错误发生时的配置 |
| `cause` | `Error \| undefined` | 导致此错误的原始错误 |
| `isNetworkError` | `boolean` | `code === WSErrorType.NETWORK` 的简写 |
| `isParseError` | `boolean` | `code === WSErrorType.PARSE` 的简写 |
| `isTimeout` | `boolean` | `code === WSErrorType.TIMEOUT` 的简写 |
| `isConfigError` | `boolean` | `code === WSErrorType.CONFIG` 的简写 |

## 插件系统

WebSocket 模块有自己的插件系统，独立于核心 `afetch` 插件系统。

### 插件接口

```typescript
import type { WSPlugin } from '@ahriknow/afetch/ws';

const myPlugin: WSPlugin = {
    name: 'my-plugin',
    install(api) {
        api.addHook('open', (ctx) => { /* ... */ });
        api.addHook('message', (ctx) => { /* ... */ });
        api.addHook('error', (ctx) => { /* ... */ });
        api.addHook('close', (ctx) => { /* ... */ });
        api.addHook('send', (ctx) => { /* ... */ });
    },
};
```

### 钩子上下文

| 钩子 | 上下文 | 说明 |
|------|---------|------|
| `open` | `{ config, url }` | 连接建立时触发 |
| `message` | `{ config, message }` | 收到每条消息时触发 |
| `error` | `{ config, error, attempt }` | 发生错误时触发；返回 `false` 阻止重连 |
| `close` | `{ config, code, reason, reconnectCount, wasClean }` | 连接终止时触发 |
| `send` | `{ config, data }` | 发送数据前触发 |

### 消息结构

```typescript
interface WSMessage {
    data: unknown;     // 解析后的数据（如果启用了 autoParse）
    raw: string;       // 原始消息字符串
    origin?: string;   // 消息事件的来源
    timestamp: number; // 接收时的时间戳
}
```

## 自动重连插件

用于控制重连行为的内置插件：

```typescript
import { createAutoReconnectPlugin } from '@ahriknow/afetch/ws';

ws.use(createAutoReconnectPlugin({
    maxAttempts: 5,
    delay: 2000,
    shouldReconnect: (ctx) => {
        // 特定关闭码时不重连
        if (ctx.error.code === 'NETWORK' && ctx.attempt >= 3) {
            return false;
        }
        return true;
    },
}));
```

### 选项

| 选项 | 类型 | 默认值 | 说明 |
|--------|------|---------|------|
| `maxAttempts` | `number` | `undefined` | 最大重连次数 |
| `delay` | `number \| (attempt: number) => number` | `undefined` | 自定义重连延迟（覆盖配置） |
| `shouldReconnect` | `(ctx: WSErrorContext) => boolean` | `undefined` | 重连决策的自定义断言 |

## 请求同步插件

用于在 WebSocket 上实现请求-响应模式的内置插件。为发出的消息分配唯一 ID，并匹配收到的响应：

```typescript
import { createWS, createRequestSyncPlugin } from '@ahriknow/afetch/ws';

const ws = createWS('wss://api.example.com/ws');
const sync = createRequestSyncPlugin({
    timeout: 5000,
    idGenerator: () => crypto.randomUUID(),
});

ws.use(sync);

// 发送请求并等待匹配的响应
const response = await sync.request('getUser', { id: 123 });
console.log(response.data); // 响应数据

// 发送但不等待响应
sync.send('notify', { type: 'update' });
```

### 选项

| 选项 | 类型 | 默认值 | 说明 |
|--------|------|---------|------|
| `timeout` | `number` | `30000` | 等待响应的超时时间（毫秒） |
| `idGenerator` | `() => string` | `createNumericIdGenerator()` | 生成唯一请求 ID 的函数 |
| `requestFormatter` | `(id, type, payload) => any` | `undefined` | 自定义请求消息格式 |
| `responseIdExtractor` | `(message) => string \| undefined` | `undefined` | 从响应中提取请求 ID |
| `responseMatcher` | `(message, requestId) => boolean` | `undefined` | 自定义响应匹配逻辑 |
| `responseDataExtractor` | `(message) => any` | `undefined` | 从响应消息中提取数据 |

## 自定义插件

### 日志插件

```typescript
ws.use({
    name: 'ws-logger',
    install(api) {
        api.addHook('open', ({ url }) => {
            console.log(`[WS] 已连接到 ${url}`);
        });
        api.addHook('message', ({ message }) => {
            console.log(`[WS] 收到:`, message.data);
        });
        api.addHook('send', ({ data }) => {
            console.log(`[WS] 发送:`, data);
        });
        api.addHook('error', ({ error, attempt }) => {
            console.error(`[WS] 错误（第 ${attempt + 1} 次尝试）:`, error.message);
        });
        api.addHook('close', ({ code, reason, reconnectCount }) => {
            console.log(`[WS] 已关闭 ${code} ${reason}（重连了 ${reconnectCount} 次）`);
        });
    },
});
```

### 带自定义逻辑的自动重连

```typescript
import { createAutoReconnectPlugin } from '@ahriknow/afetch/ws';

ws.use(createAutoReconnectPlugin({
    maxAttempts: 10,
    delay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000), // 指数退避，最大 30s
    shouldReconnect: (ctx) => {
        // 认证失败时不重连
        if (ctx.error.cause instanceof CloseEvent) {
            return ctx.error.cause.code !== 4001; // 自定义认证错误码
        }
        return true;
    },
}));
```

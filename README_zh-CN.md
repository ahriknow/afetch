<div align="center">

# afetch

[English](./README.md) | **中文**

轻量、类型安全、插件化的 Fetch API 封装库。

[![npm version](https://img.shields.io/npm/v/@ahriknow/afetch.svg)](https://www.npmjs.com/package/@ahriknow/afetch)
[![license](https://img.shields.io/npm/l/@ahriknow/afetch.svg)](./LICENSE)
[![codecov](https://codecov.io/gh/ahriknow/afetch/branch/develop/graph/badge.svg?token=NDSDK60RUM)](https://codecov.io/gh/ahriknow/afetch)
[![typescript](https://img.shields.io/badge/TypeScript-7.0-blue.svg)](https://www.typescriptlang.org/)

</div>

---

## 特性

- 🚀 **轻量** — 零依赖，极小的打包体积
- 🔒 **类型安全** — 完整的 TypeScript 支持，严格类型推断
- 🧩 **插件系统** — 通过 `beforeRequest`、`afterResponse`、`onError` 钩子扩展功能
- 🔁 **重试插件** — 自动重试，支持指数退避、状态码匹配、自定义 hook
- 📡 **事件总线插件** — 通过事件监听请求生命周期
- ⏱️ **超时** — 请求超时自动中断
- ❌ **取消** — 支持 AbortController + Task API 细粒度控制
- 📊 **进度** — 上传和下载进度追踪
- 🏗️ **实例** — 创建预配置的请求实例
- 🔧 **转换** — 请求和响应数据转换
- 🌐 **通用** — 支持浏览器（Chrome 42+、Firefox 39+、Safari 10.1+）和 Node.js 18+

## 安装

```bash
npm install @ahriknow/afetch
```

## 快速开始

```typescript
import { afetch } from '@ahriknow/afetch';

// GET 请求
const { data } = await afetch.get<User[]>('/api/users');

// POST 请求
const { data: user } = await afetch.post<User>('/api/users', {
    name: '张三',
    email: 'zhangsan@example.com',
});

// 带配置项
const { data: item } = await afetch.get<Item>('/api/items/1', {
    headers: { Authorization: 'Bearer token' },
    timeout: 5000,
    params: { fields: 'name,email' },
});
```

## 创建实例

```typescript
import { createInstance } from '@ahriknow/afetch';

const api = createInstance({
    baseURL: 'https://api.example.com',
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

const { data: users } = await api.get<User[]>('/users');
const { data: user } = await api.post<User>('/users', { name: '张三' });
```

### 重试插件

```typescript
import { createRetryPlugin } from '@ahriknow/afetch';

const api = createInstance({ baseURL: 'https://api.example.com' });

// 插件级默认配置——所有请求自动继承
api.use(createRetryPlugin({
    maxRetries: 3,
    delay: 1000,
    retryOn: [500, 502, 503, 504],
}));

// 使用插件默认配置（遇到 5xx 错误自动重试 3 次）
await api.get('/api/data');

// 单个请求覆盖插件配置
await api.get('/api/critical', {
    meta: { retry: { maxRetries: 5, delay: 2000 } },
});

// 指数退避
api.use(createRetryPlugin({
    maxRetries: 5,
    delay: (attempt) => Math.pow(2, attempt) * 1000,
}));

// 高级用法：401 时自动刷新 token
api.use(createRetryPlugin({
    maxRetries: 3,
    delay: 1000,
    retryOn: [
        500,
        {
            hook: async (error) => error.status === 401,
            retryDelay: 0,
            call: async () => {
                const token = await refreshToken();
                api.defaults.headers!['Authorization'] = `Bearer ${token}`;
            },
        },
    ],
}));

// 请求级自定义条件函数
await api.get('/api/data', {
    meta: {
        retry: {
            condition: (attempt, error) => error.status === 503 && attempt < 2,
        },
    },
});
```

### 事件总线插件

```typescript
import { createEventBusPlugin } from '@ahriknow/afetch';

const api = createInstance({ baseURL: 'https://api.example.com' });
const eventBus = createEventBusPlugin();
api.use(eventBus);

// 监听请求事件
const unsub = eventBus.on('request', ({ config }) => {
    console.log(`→ ${config.method} ${config.url}`);
});

// 监听响应事件
eventBus.on('response', ({ config, response }) => {
    console.log(`← ${response.status} ${config.url}`);
});

// 监听错误事件
eventBus.on('error', ({ config, error }) => {
    console.error(`✗ ${error.code} ${config.url}`);
});

// 取消监听
unsub();

// 移除某个事件的所有监听器
eventBus.off('response');
```

### 队列插件

自动控制并发请求执行。只需安装插件，所有请求自动受并发限制：

```typescript
import { createQueuePlugin } from '@ahriknow/afetch';

const queue = createQueuePlugin({ maxConcurrent: 3 });
api.use(queue);

// 所有请求自动排队，最多 3 个同时执行
const results = await Promise.all(
    urls.map(url => api.get(url))
);

console.log('执行中:', queue.pending);
console.log('排队中:', queue.queued);
queue.clear(); // 拒绝所有等待中的请求
```

### 缓存插件

自动缓存 GET 响应：

```typescript
import { createCachePlugin } from '@ahriknow/afetch';

api.use(createCachePlugin({
    maxAge: 30_000,
    maxSize: 50,
    // 可选：按请求决定是否缓存
    shouldCache: (config, response) => {
        if (response.status >= 400) return false;
        if (config.url.startsWith('/users')) return { maxAge: 60_000 };
        return true; // 使用默认 maxAge
    },
}));

// 第一次请求——网络请求
const users1 = await api.get('/users');

// 第二次请求——从缓存返回（无网络请求）
const users2 = await api.get('/users');

// POST 请求不会被缓存
await api.post('/users', { name: '张三' });
```

### 编写自定义插件

```typescript
import type { AFetchPlugin } from '@ahriknow/afetch';

const loggerPlugin: AFetchPlugin = {
    name: 'logger',
    install(api) {
        api.addHook('beforeRequest', ({ config }) => {
            console.log(`[REQ] ${config.method} ${config.baseURL}${config.url}`);
        });

        api.addHook('afterResponse', ({ response }) => {
            console.log(`[RES] ${response.status} ${response.statusText}`);
        });

        api.addHook('onError', ({ error }) => {
            console.error(`[ERR] ${error.code}: ${error.message}`);
        });
    },
};

api.use(loggerPlugin);
```

### 插件生命周期钩子

| 钩子 | 触发时机 | 返回值 |
|------|---------|--------|
| `beforeRequest` | 请求发送前 | `AResponse`（缓存命中）或 `void` |
| `afterResponse` | 收到响应后 | `AResponse`（替换响应）或 `void` |
| `onError` | 请求出错时 | `AResponse`（重试/替换）或 `void`（传播错误） |

插件按实例安装——同一插件重复调用 `use()` 不会重复安装。

## 文档

| 主题 | 说明 |
|------|------|
| [错误处理](./docs/zh-CN/error-handling.md) | AFetchError、错误类型和错误处理模式 |
| [取消请求](./docs/zh-CN/cancellation.md) | Task API 和 AbortController |
| [数据转换](./docs/zh-CN/transforms.md) | 请求和响应数据转换 |
| [TypeScript 支持](./docs/zh-CN/typescript.md) | 类型定义和泛型支持 |
| [配置](./docs/zh-CN/configuration.md) | 实例和单次请求配置选项 |
| [API 参考](./docs/zh-CN/api-reference.md) | 完整 API 参考 |

## 许可证

[MIT](./LICENSE)

<div align="center">

# afetch

[English](./README.md) | **中文**

轻量、类型安全、插件化的 Fetch API 封装库。

[![npm version](https://img.shields.io/npm/v/@ahriknow/afetch.svg)](https://www.npmjs.com/package/@ahriknow/afetch)
[![license](https://img.shields.io/npm/l/@ahriknow/afetch.svg)](./LICENSE)
[![codecov](https://codecov.io/gh/ahriknow/afetch/graph/badge.svg?token=NDSDK60RUM)](https://codecov.io/gh/ahriknow/afetch)
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
npm install afetch
```

## 快速开始

```typescript
import { afetch } from 'afetch';

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
import { createInstance } from 'afetch';

const api = createInstance({
    baseURL: 'https://api.example.com',
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

const { data: users } = await api.get<User[]>('/users');
const { data: user } = await api.post<User>('/users', { name: '张三' });
```

## 插件系统

afetch 采用插件架构。核心功能保持精简——重试、事件监听等功能通过插件提供。

### 内置插件

#### 重试插件

```typescript
import { createRetryPlugin } from 'afetch';

const api = createInstance({ baseURL: 'https://api.example.com' });
api.use(createRetryPlugin());

// 基本重试
await api.get('/api/data', {
    meta: { retry: { maxRetries: 3, delay: 1000 } },
});

// 仅在特定状态码时重试
await api.get('/api/data', {
    meta: {
        retry: {
            maxRetries: 3,
            delay: 1000,
            retryOn: [500, 502, 503, 504],
        },
    },
});

// 指数退避
await api.get('/api/data', {
    meta: {
        retry: {
            maxRetries: 5,
            delay: (attempt) => Math.pow(2, attempt) * 1000,
        },
    },
});

// 高级用法：401 时自动刷新 token
await api.get('/api/protected', {
    meta: {
        retry: {
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
        },
    },
});

// 自定义条件函数
await api.get('/api/data', {
    meta: {
        retry: {
            maxRetries: 3,
            condition: (attempt, error) => error.status === 503 && attempt < 2,
        },
    },
});
```

#### 事件总线插件

```typescript
import { createEventBusPlugin } from 'afetch';

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

### 编写自定义插件

```typescript
import type { AFetchPlugin } from 'afetch';

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

#### 插件生命周期钩子

| 钩子 | 触发时机 | 返回值 |
|------|---------|--------|
| `beforeRequest` | 请求发送前 | `void` |
| `afterResponse` | 收到响应后 | `AResponse`（替换响应）或 `void` |
| `onError` | 请求出错时 | `AResponse`（重试/替换）或 `void`（传播错误） |

插件按实例安装——同一插件重复调用 `use()` 不会重复安装。

## 错误处理

```typescript
import { AFetchError, AFetchErrorType } from 'afetch';

try {
    await api.get('/api/data');
} catch (error) {
    if (error instanceof AFetchError) {
        switch (error.code) {
            case AFetchErrorType.TIMEOUT:
                console.log('请求超时');
                break;
            case AFetchErrorType.HTTP:
                console.log(`HTTP ${error.status}: ${error.message}`);
                break;
            case AFetchErrorType.NETWORK:
                console.log('网络错误');
                break;
            case AFetchErrorType.ABORT:
                console.log('请求已取消');
                break;
        }
    }
}
```

## 取消请求

### Task API（推荐）

Task API 会立即发起请求，并返回一个句柄来控制请求：

```typescript
// 创建任务——请求立即发起
const task = api.task.get('/api/data', {
    headers: { Authorization: 'Bearer token' },
});

// 检查状态
console.log(task.done);    // false
console.log(task.aborted); // false

// 取消请求
task.abort();
console.log(task.aborted); // true

// 等待响应——如果已取消则抛出 AFetchError(ABORT)
try {
    const response = await task.wait();
    console.log(response.data);
} catch (error) {
    if (error.code === 'EABORT') {
        console.log('请求已取消');
    }
}
```

支持所有 HTTP 方法：

```typescript
const getTask = api.task.get('/api/users');
const postTask = api.task.post('/api/users', { name: '张三' });
const putTask = api.task.put('/api/users/1', { name: '已更新' });
const deleteTask = api.task.delete('/api/users/1');
const patchTask = api.task.patch('/api/users/1', { name: '已修改' });
```

### AbortController

也可以使用标准的 AbortController 方式：

```typescript
const controller = new AbortController();

const { data } = await api.get('/api/data', {
    signal: controller.signal,
    timeout: 5000, // 5 秒后自动取消
});

// 手动取消
controller.abort();
```

## 请求与响应转换

```typescript
// 发送前转换请求数据
await api.post('/api/data', rawData, {
    transformRequest: (data) => ({
        ...(data as object),
        timestamp: Date.now(),
    }),
});

// 接收后转换响应数据
const { data } = await api.get<Item[]>('/api/items', {
    transformResponse: (data) => (data as any).items,
});
```

## TypeScript 支持

完整的泛型类型支持：

```typescript
interface User {
    id: number;
    name: string;
    email: string;
}

// 响应数据完全类型化
const { data } = await api.get<User[]>('/users');
//    ^ User[]

const { data: user } = await api.post<User>('/users', { name: '张三' });
//    ^ User
```

## 配置选项

```typescript
const api = createInstance({
    baseURL: 'https://api.example.com',  // 基础 URL
    timeout: 10000,                       // 默认超时（毫秒）
    headers: {                            // 默认请求头
        'Content-Type': 'application/json',
    },
    responseType: 'json',                 // 默认响应类型
    cache: 'default',                     // 请求缓存模式
    credentials: 'same-origin',           // 凭证模式
    throwOnError: true,                   // 非 2xx 抛出错误（默认 true）
    fetchAdapter: customFetch,            // 自定义 fetch 实现
    plugins: [createRetryPlugin()],       // 安装插件
});
```

### 单次请求配置

```typescript
await api.get('/data', {
    headers: { 'X-Custom': 'value' },
    params: { page: 1, limit: 20 },
    timeout: 3000,
    signal: controller.signal,
    responseType: 'text',
    cache: 'no-cache',
    throwOnError: false,
    meta: { requestId: '123' },
    transformRequest: fn,
    transformResponse: fn,
    onUploadProgress: fn,
    onDownloadProgress: fn,
});
```

## API 参考

### 实例方法

| 方法 | 说明 |
|------|------|
| `afetch.get<T>(url, options?)` | GET 请求 |
| `afetch.post<T>(url, data?, options?)` | POST 请求 |
| `afetch.put<T>(url, data?, options?)` | PUT 请求 |
| `afetch.delete<T>(url, options?)` | DELETE 请求 |
| `afetch.patch<T>(url, data?, options?)` | PATCH 请求 |
| `afetch.head<T>(url, options?)` | HEAD 请求 |
| `afetch.options<T>(url, options?)` | OPTIONS 请求 |
| `afetch.request<T>(url, options?)` | 自定义方法请求 |
| `afetch.create(config?)` | 创建新实例 |
| `afetch.use(plugin)` | 安装插件 |
| `afetch.task` | Task API，用于可取消的请求 |
| `afetch.defaults` | 默认配置 |

### 响应对象 (`AResponse<T>`)

| 属性 | 类型 | 说明 |
|------|------|------|
| `data` | `T` | 解析后的响应数据 |
| `status` | `number` | HTTP 状态码 |
| `statusText` | `string` | HTTP 状态文本 |
| `headers` | `Headers` | 响应头 |
| `config` | `ResolvedRequestConfig` | 请求配置 |
| `raw` | `Response` | 原始 Response 对象 |
| `ok` | `boolean` | `status >= 200 && status < 300` |

### 请求任务 (`RequestTask<T>`)

| 属性 / 方法 | 类型 | 说明 |
|-------------|------|------|
| `abort()` | `() => void` | 取消请求 |
| `wait()` | `() => Promise<AResponse<T>>` | 等待响应（取消后调用会抛出错误）|
| `aborted` | `boolean` | 请求是否已被取消 |
| `done` | `boolean` | 请求是否已完成 |

### 错误类型 (`AFetchErrorType`)

| 代码 | 说明 |
|------|------|
| `TIMEOUT` | 请求超时 |
| `NETWORK` | 网络错误 |
| `ABORT` | 请求被取消 |
| `HTTP` | 非 2xx 响应 |
| `PARSE` | 响应解析错误 |
| `CONFIG` | 配置错误 |

## 项目结构

```
afetch/
├── src/
│   ├── index.ts            # 入口文件
│   ├── afetch.ts           # 核心实现
│   ├── types.ts            # 类型定义
│   ├── plugin.ts           # 插件系统（HookRunner）
│   ├── events.ts           # 事件发射器
│   ├── error.ts            # AFetchError 类
│   ├── utils.ts            # 工具函数
│   └── plugins/
│       ├── index.ts        # 插件导出
│       ├── retry.ts        # 重试插件
│       └── event-bus.ts    # 事件总线插件
├── test/
│   ├── afetch.test.ts      # 单元测试
│   └── coverage.test.ts    # 覆盖率测试
├── examples/
│   ├── basic.ts            # 基本用法
│   ├── plugins.ts          # 插件示例
│   └── task.ts             # Task API 示例
├── .github/
│   └── workflows/
│       └── publish.yml     # CI/CD
├── package.json
├── tsconfig.json
└── README.md
```

## 许可证

[MIT](./LICENSE)

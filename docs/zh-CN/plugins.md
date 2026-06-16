# 插件系统

[← 返回 README](../../README_zh-CN.md)

afetch 采用插件架构。核心功能保持精简——重试、事件监听等功能通过插件提供。

## 内置插件

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

## 编写自定义插件

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

## 插件生命周期钩子

| 钩子 | 触发时机 | 返回值 |
|------|---------|--------|
| `beforeRequest` | 请求发送前 | `AResponse`（缓存命中）或 `void` |
| `afterResponse` | 收到响应后 | `AResponse`（替换响应）或 `void` |
| `onError` | 请求出错时 | `AResponse`（重试/替换）或 `void`（传播错误） |

插件按实例安装——同一插件重复调用 `use()` 不会重复安装。

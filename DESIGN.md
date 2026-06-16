# afetch - 轻量级 Fetch API 封装库

## 项目概述

afetch 是一个基于 Web Fetch API 的轻量级封装库，提供更友好、更强大的 HTTP 请求功能。项目使用 TypeScript 7.0 开发，充分利用其新特性。

## 技术栈

- **TypeScript 7.0** - 使用最新版本，享受 10 倍编译速度提升
- **ESNext 模块** - 使用现代 JavaScript 特性
- **严格模式** - TypeScript 7.0 默认开启 strict 模式

## 核心功能设计

### 1. 基础请求方法

```typescript
// GET 请求
afetch.get(url, options?)

// POST 请求
afetch.post(url, data, options?)

// PUT 请求
afetch.put(url, data, options?)

// DELETE 请求
afetch.delete(url, options?)

// PATCH 请求
afetch.patch(url, data, options?)

// HEAD 请求
afetch.head(url, options?)

// OPTIONS 请求
afetch.options(url, options?)
```

### 2. 请求配置选项

```typescript
interface AFetchOptions {
  // 基础配置
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: BodyInit | null;
  
  // 超时配置
  timeout?: number; // 请求超时时间（毫秒）
  
  // 重试配置
  retry?: number; // 重试次数
  retryDelay?: number; // 重试延迟（毫秒）
  retryOn?: RetryOnConfig[]; // 重试条件配置，支持简单数字和高级 hook 格式
  
  // 请求取消
  signal?: AbortSignal;
  
  // 响应类型
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData';
  
  // 请求拦截
  onRequest?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
  onResponse?: (response: Response) => Response | Promise<Response>;
  onError?: (error: Error) => Error | Promise<Error>;
  
  // 缓存配置
  cache?: 'default' | 'no-store' | 'reload' | 'no-cache' | 'force-cache';
  
  // 认证配置
  auth?: {
    type: 'basic' | 'bearer' | 'token';
    credentials: string;
  };
  
  // 查询参数
  params?: Record<string, string | number | boolean>;
  
  // 进度回调
  onUploadProgress?: (progress: ProgressEvent) => void;
  onDownloadProgress?: (progress: ProgressEvent) => void;
}
```

### 3. 响应对象

```typescript
interface AResponse<T = any> {
  data: T; // 解析后的响应数据
  status: number; // HTTP 状态码
  statusText: string; // 状态文本
  headers: Headers; // 响应头
  config: RequestConfig; // 请求配置
  request: Request; // 原始请求对象
  
  // 便捷方法
  ok: boolean; // status >= 200 && status < 300
  json(): Promise<T>;
  text(): Promise<string>;
  blob(): Promise<Blob>;
  arrayBuffer(): Promise<ArrayBuffer>;
  formData(): Promise<FormData>;
}
```

### 4. 插件系统

```typescript
// 安装插件
const api = afetch.create({
  baseURL: 'https://api.example.com',
  plugins: [createRetryPlugin(), createEventBusPlugin()]
});

// 或后续安装
api.use(createRetryPlugin());

// 自定义插件
const myPlugin: AFetchPlugin = {
  name: 'my-plugin',
  install(api) {
    api.addHook('beforeRequest', ({ config }) => {
      config.headers['Authorization'] = `Bearer ${getToken()}`;
    });

    api.addHook('afterResponse', ({ response }) => {
      console.log('Response:', response.status);
    });

    api.addHook('onError', ({ error }) => {
      console.error('Request failed:', error.message);
    });
  }
};

api.use(myPlugin);
```

#### 插件生命周期钩子

| 钩子 | 触发时机 | 返回值 |
|------|---------|--------|
| `beforeRequest` | 请求发送前 | `void` |
| `afterResponse` | 收到响应后 | `AResponse` 或 `void` |
| `onError` | 请求出错时 | `AResponse`（重试）或 `void`（传播错误）|

### 5. 错误处理

```typescript
class AFetchError extends Error {
  config: RequestConfig;
  request?: Request;
  response?: AResponse;
  code?: string;
  status?: number;
  
  constructor(message: string, config: RequestConfig, code?: string, request?: Request, response?: AResponse);
}

// 错误类型
enum ErrorType {
  TIMEOUT = 'ETIMEDOUT',
  NETWORK = 'ENETWORK',
  ABORT = 'EABORT',
  HTTP = 'EHTTP',
  PARSE = 'EPARSE'
}
```

### 6. 请求取消 (Task 模式)

```typescript
// 创建请求任务
const task = await afetch.task.get('/api/data', {
  headers: { 'Authorization': 'Bearer token123' }
});

// 等待响应
const response = await task.wait();
console.log(response.data);

// 取消请求
task.abort();

// 如果取消了，wait() 会立刻结束并返回错误
try {
  const response = await task.wait();
} catch (error) {
  if (error.code === 'EABORT') {
    console.log('请求已取消');
  }
}

// 超时自动取消
const task = await afetch.task.get('/api/data', {
  timeout: 5000 // 5秒超时
});

// Task API
interface RequestTask<T> {
  // 取消请求
  abort(): void;
  // 等待响应，返回 AResponse<T>，如果已取消则抛出错误
  wait(): Promise<AResponse<T>>;
  // 请求是否已完成
  readonly done: boolean;
  // 请求是否已取消
  readonly aborted: boolean;
}
```

### 7. 重试插件

```typescript
import { createRetryPlugin } from 'afetch/plugins';

const api = afetch.create({
  baseURL: 'https://api.example.com',
});

// 安装修复插件
api.use(createRetryPlugin());

// 使用重试 - 通过 meta.retry 配置
api.get('/api/data', {
  meta: {
    retry: {
      maxRetries: 3,       // 最大重试次数
      delay: 1000,         // 重试间隔（毫秒）
      retryOn: [500, 502], // 仅在这些状态码时重试
    }
  }
});

// 带 hook 的高级重试
api.get('/api/data', {
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
            const newToken = await refreshToken();
            api.defaults.headers['Authorization'] = `Bearer ${newToken}`;
          }
        }
      ]
    }
  }
});

// 指数退避
api.get('/api/data', {
  meta: {
    retry: {
      maxRetries: 3,
      delay: (attempt) => Math.pow(2, attempt) * 1000,
    }
  }
});
```

### 8. 请求/响应转换

```typescript
// 请求数据转换
afetch.post('/api/data', rawData, {
  transformRequest: [(data) => {
    // 转换请求数据
    return JSON.stringify(data);
  }]
});

// 响应数据转换
afetch.get('/api/data', {
  transformResponse: [(data) => {
    // 转换响应数据
    return data.items;
  }]
});
```

### 9. 实例创建

```typescript
// 创建自定义实例
const api = afetch.create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// 使用实例
api.get('/users');
api.post('/users', { name: 'John' });
```

### 10. 并发请求

```typescript
// 并发请求
const [users, posts] = await afetch.all([
  afetch.get('/api/users'),
  afetch.get('/api/posts')
]);

// 请求竞赛
const fastest = await afetch.race([
  afetch.get('/api/server1'),
  afetch.get('/api/server2')
]);
```

## 高级功能

### 1. 请求队列

```typescript
// 配置请求队列
const api = afetch.create({
  queue: {
    maxConcurrent: 5, // 最大并发数
    maxRequestsPerSecond: 10 // 每秒最大请求数
  }
});
```

### 2. 请求缓存

```typescript
// 配置缓存
const api = afetch.create({
  cache: {
    maxAge: 5 * 60 * 1000, // 缓存5分钟
    maxSize: 100, // 最大缓存数量
    key: (config) => `${config.method}:${config.url}` // 缓存键生成
  }
});

// 清除缓存
api.clearCache();
```

### 3. 事件总线插件

```typescript
import { createEventBusPlugin } from 'afetch/plugins';

const api = afetch.create({ baseURL: 'https://api.example.com' });
const eventBus = createEventBusPlugin();
api.use(eventBus);

// 监听请求事件
const unsub = eventBus.on('request', ({ config }) => {
  console.log('Request:', config.method, config.url);
});

// 监听响应事件
eventBus.on('response', ({ config, response }) => {
  console.log('Response:', response.status, config.url);
});

// 监听错误事件
eventBus.on('error', ({ config, error }) => {
  console.error('Error:', error.message, config.url);
});

// 取消监听
unsub();

// 清除所有监听
eventBus.off('request');
```

### 4. 请求重试策略

```typescript
// 指数退避重试
afetch.get('/api/data', {
  retry: 3,
  retryDelay: (attempt) => Math.pow(2, attempt) * 1000 // 指数退避
});

// 使用 retryOn 高级配置：401 自动刷新 token
const api = afetch.create({
  baseURL: 'https://api.example.com',
});
api.use(createRetryPlugin());

api.get('/api/data', {
  meta: {
    retry: {
      maxRetries: 3,
      delay: 1000,
      retryOn: [
        500, 502, 503, 504,
        {
          hook: async (error) => error.status === 401,
          retryDelay: 0,
          call: async () => {
            const { token } = await refreshToken();
            api.defaults.headers = {
              ...api.defaults.headers,
              'Authorization': `Bearer ${token}`
            };
          }
        }
      ]
    }
  }
});

// 自定义重试条件（condition 函数）
api.get('/api/data', {
  meta: {
    retry: {
      maxRetries: 3,
      condition: (attempt, error) => {
        // 只在特定条件下重试
        return attempt < 3 && error.status === 503;
      }
    }
  }
});
```

### 4. 请求进度跟踪

```typescript
// 上传进度
afetch.post('/api/upload', formData, {
  onUploadProgress: (progress) => {
    const percent = Math.round((progress.loaded / progress.total) * 100);
    console.log(`上传进度: ${percent}%`);
  }
});

// 下载进度
afetch.get('/api/download', {
  onDownloadProgress: (progress) => {
    const percent = Math.round((progress.loaded / progress.total) * 100);
    console.log(`下载进度: ${percent}%`);
  }
});
```

### 5. 请求元数据

```typescript
// 添加元数据
afetch.get('/api/data', {
  meta: {
    requestId: '12345',
    timestamp: Date.now(),
    retryCount: 0
  }
});
```

## TypeScript 7.0 特性利用

### 1. 严格类型检查

利用 TypeScript 7.0 默认的 strict 模式，提供完整的类型定义和类型推断。

### 2. 现代模块系统

使用 ESNext 模块系统，支持 tree-shaking 和更好的代码分割。

### 3. 性能优化

利用 TypeScript 7.0 的编译速度提升，加快开发体验。

## 项目结构

```
afetch/
├── src/
│   ├── index.ts          # 主入口文件
│   ├── afetch.ts         # 核心实现
│   ├── types.ts          # 类型定义
│   ├── interceptors.ts   # 拦截器实现
│   ├── error.ts          # 错误处理
│   ├── utils.ts          # 工具函数
│   └── adapters/         # 适配器
│       ├── fetch.ts      # Fetch API 适配器
│       └── xhr.ts        # XMLHttpRequest 适配器
├── test/                 # 测试文件
├── examples/             # 示例代码
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

## 测试策略

1. **单元测试** - 使用 Jest 测试各个模块
2. **集成测试** - 测试模块间的交互
3. **端到端测试** - 测试真实 HTTP 请求
4. **性能测试** - 测试请求性能和内存使用

## 发布计划

1. **Alpha 版本** - 核心功能实现
2. **Beta 版本** - 功能完善，性能优化
3. **RC 版本** - 稳定版本，文档完善
4. **正式版本** - 生产环境就绪

## 文档计划

1. **API 文档** - 完整的 API 参考
2. **使用指南** - 详细的使用说明
3. **示例代码** - 常见使用场景
4. **迁移指南** - 从其他库迁移

## 依赖管理

### 生产依赖
- 无（纯 Fetch API 封装）

### 开发依赖
- TypeScript 7.0
- Jest (测试框架)
- ESLint (代码检查)
- Prettier (代码格式化)
- TypeDoc (文档生成)

## 兼容性

### 浏览器支持
- Chrome 42+
- Firefox 39+
- Safari 10.1+
- Edge 14+

### Node.js 支持
- Node.js 18+ (原生 Fetch API)

### TypeScript 版本
- TypeScript 7.0+

## 性能目标

1. **包大小** - < 5KB (gzipped)
2. **请求延迟** - < 1ms 额外开销
3. **内存使用** - 最小化内存占用
4. **编译速度** - 利用 TypeScript 7.0 的快速编译

## 安全性

1. **输入验证** - 验证所有输入参数
2. **XSS 防护** - 防止跨站脚本攻击
3. **CSRF 防护** - 支持 CSRF token
4. **HTTPS 优先** - 默认使用 HTTPS

## 监控和调试

1. **请求日志** - 记录请求和响应
2. **性能监控** - 监控请求性能
3. **错误追踪** - 追踪和报告错误
4. **调试工具** - 提供调试接口

## 未来扩展

1. **WebSocket 支持** - 封装 WebSocket API
2. **Server-Sent Events** - 支持 SSE
3. **GraphQL 支持** - 内置 GraphQL 支持
4. **Mock 支持** - 内置 Mock 功能
5. **插件系统** - 支持自定义插件

## 设计原则

1. **简单易用** - 提供简洁的 API
2. **功能强大** - 覆盖常见使用场景
3. **类型安全** - 完整的 TypeScript 支持
4. **高性能** - 最小化性能开销
5. **可扩展** - 支持自定义扩展
6. **兼容性** - 广泛的浏览器和环境支持
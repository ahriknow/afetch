<div align="center">

# afetch

**English** | [中文](./README_zh-CN.md)

A lightweight, type-safe, plugin-based fetch API wrapper for modern JavaScript/TypeScript.

[![npm version](https://img.shields.io/npm/v/@ahriknow/afetch.svg)](https://www.npmjs.com/package/@ahriknow/afetch)
[![license](https://img.shields.io/npm/l/@ahriknow/afetch.svg)](./LICENSE)
[![codecov](https://codecov.io/gh/ahriknow/afetch/branch/develop/graph/badge.svg?token=NDSDK60RUM)](https://codecov.io/gh/ahriknow/afetch)
[![typescript](https://img.shields.io/badge/TypeScript-7.0-blue.svg)](https://www.typescriptlang.org/)

</div>

---

## Features

- 🚀 **Lightweight** — Zero dependencies, minimal bundle size
- 🔒 **Type-safe** — Full TypeScript support with strict types
- 🧩 **Plugin System** — Extensible via `beforeRequest`, `afterResponse`, `onError` hooks
- 🔁 **Retry Plugin** — Automatic retry with exponential backoff, status matching, and custom hooks
- 📡 **Event Bus Plugin** — Observe request lifecycle via events
- ⏱️ **Timeout** — Request timeout with automatic abort
- ❌ **Cancellation** — AbortController support + Task API for fine-grained control
- 📊 **Progress** — Upload and download progress tracking
- 🏗️ **Instances** — Create pre-configured instances for different APIs
- 🔧 **Transforms** — Request and response data transformation
- 🌐 **Universal** — Works in browsers (Chrome 42+, Firefox 39+, Safari 10.1+) and Node.js 18+

## Installation

```bash
npm install afetch
```

## Quick Start

```typescript
import { afetch } from 'afetch';

// GET request
const { data } = await afetch.get<User[]>('/api/users');

// POST request
const { data: user } = await afetch.post<User>('/api/users', {
    name: 'John Doe',
    email: 'john@example.com',
});

// With options
const { data: item } = await afetch.get<Item>('/api/items/1', {
    headers: { Authorization: 'Bearer token' },
    timeout: 5000,
    params: { fields: 'name,email' },
});
```

## Creating Instances

```typescript
import { createInstance } from 'afetch';

const api = createInstance({
    baseURL: 'https://api.example.com',
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

const { data: users } = await api.get<User[]>('/users');
const { data: user } = await api.post<User>('/users', { name: 'John' });
```

## Plugin System

afetch uses a plugin architecture. Core functionality is minimal — features like retry and event observation are provided as plugins.

### Built-in Plugins

#### Retry Plugin

```typescript
import { createRetryPlugin } from 'afetch';

const api = createInstance({ baseURL: 'https://api.example.com' });
api.use(createRetryPlugin());

// Basic retry
await api.get('/api/data', {
    meta: { retry: { maxRetries: 3, delay: 1000 } },
});

// Retry on specific status codes
await api.get('/api/data', {
    meta: {
        retry: {
            maxRetries: 3,
            delay: 1000,
            retryOn: [500, 502, 503, 504],
        },
    },
});

// Exponential backoff
await api.get('/api/data', {
    meta: {
        retry: {
            maxRetries: 5,
            delay: (attempt) => Math.pow(2, attempt) * 1000,
        },
    },
});

// Advanced: hook + call for token refresh on 401
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

// Custom condition function
await api.get('/api/data', {
    meta: {
        retry: {
            maxRetries: 3,
            condition: (attempt, error) => error.status === 503 && attempt < 2,
        },
    },
});
```

#### Event Bus Plugin

```typescript
import { createEventBusPlugin } from 'afetch';

const api = createInstance({ baseURL: 'https://api.example.com' });
const eventBus = createEventBusPlugin();
api.use(eventBus);

// Listen to lifecycle events
const unsub = eventBus.on('request', ({ config }) => {
    console.log(`→ ${config.method} ${config.url}`);
});

eventBus.on('response', ({ config, response }) => {
    console.log(`← ${response.status} ${config.url}`);
});

eventBus.on('error', ({ config, error }) => {
    console.error(`✗ ${error.code} ${config.url}`);
});

// Unsubscribe
unsub();

// Remove all listeners for an event
eventBus.off('response');
```

### Writing Custom Plugins

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

#### Plugin Lifecycle Hooks

| Hook | When | Return |
|------|------|--------|
| `beforeRequest` | Before sending request | `void` |
| `afterResponse` | After receiving response | `AResponse` (replace) or `void` |
| `onError` | On request error | `AResponse` (retry/replace) or `void` (propagate) |

Plugins are installed once per instance — calling `use()` with the same plugin name is a no-op.

## Error Handling

```typescript
import { AFetchError, AFetchErrorType } from 'afetch';

try {
    await api.get('/api/data');
} catch (error) {
    if (error instanceof AFetchError) {
        switch (error.code) {
            case AFetchErrorType.TIMEOUT:
                console.log('Request timed out');
                break;
            case AFetchErrorType.HTTP:
                console.log(`HTTP ${error.status}: ${error.message}`);
                break;
            case AFetchErrorType.NETWORK:
                console.log('Network error');
                break;
            case AFetchErrorType.ABORT:
                console.log('Request aborted');
                break;
        }
    }
}
```

## Request Cancellation

### Task API (Recommended)

The Task API starts the request immediately and returns a handle to control it:

```typescript
// Create a task — request starts immediately
const task = api.task.get('/api/data', {
    headers: { Authorization: 'Bearer token' },
});

// Check status
console.log(task.done);    // false
console.log(task.aborted); // false

// Cancel the request
task.abort();
console.log(task.aborted); // true

// Wait for response — throws AFetchError(ABORT) if cancelled
try {
    const response = await task.wait();
    console.log(response.data);
} catch (error) {
    if (error.code === 'EABORT') {
        console.log('Request was aborted');
    }
}
```

Supports all HTTP methods:

```typescript
const getTask = api.task.get('/api/users');
const postTask = api.task.post('/api/users', { name: 'John' });
const putTask = api.task.put('/api/users/1', { name: 'Updated' });
const deleteTask = api.task.delete('/api/users/1');
const patchTask = api.task.patch('/api/users/1', { name: 'Patched' });
```

### AbortController

You can also use the standard `AbortController` approach:

```typescript
const controller = new AbortController();

const { data } = await api.get('/api/data', {
    signal: controller.signal,
    timeout: 5000, // auto-abort after 5s
});

// Cancel manually
controller.abort();
```

## Request & Response Transforms

```typescript
// Transform request data before sending
await api.post('/api/data', rawData, {
    transformRequest: (data) => ({
        ...(data as object),
        timestamp: Date.now(),
    }),
});

// Transform response data after receiving
const { data } = await api.get<Item[]>('/api/items', {
    transformResponse: (data) => (data as any).items,
});
```

## TypeScript Support

Full generic type support:

```typescript
interface User {
    id: number;
    name: string;
    email: string;
}

// Response data is fully typed
const { data } = await api.get<User[]>('/users');
//    ^ User[]

const { data: user } = await api.post<User>('/users', { name: 'John' });
//    ^ User
```

## Configuration Options

```typescript
const api = createInstance({
    baseURL: 'https://api.example.com',  // Base URL for all requests
    timeout: 10000,                       // Default timeout (ms)
    headers: {                            // Default headers
        'Content-Type': 'application/json',
    },
    responseType: 'json',                 // Default response type
    cache: 'default',                     // Request cache mode
    credentials: 'same-origin',           // Credentials mode
    throwOnError: true,                   // Throw on non-2xx (default: true)
    fetchAdapter: customFetch,            // Custom fetch implementation
    plugins: [createRetryPlugin()],       // Plugins to install
});
```

### Per-request Options

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

## API Reference

### Instance Methods

| Method | Description |
|--------|-------------|
| `afetch.get<T>(url, options?)` | GET request |
| `afetch.post<T>(url, data?, options?)` | POST request |
| `afetch.put<T>(url, data?, options?)` | PUT request |
| `afetch.delete<T>(url, options?)` | DELETE request |
| `afetch.patch<T>(url, data?, options?)` | PATCH request |
| `afetch.head<T>(url, options?)` | HEAD request |
| `afetch.options<T>(url, options?)` | OPTIONS request |
| `afetch.request<T>(url, options?)` | Custom method request |
| `afetch.create(config?)` | Create a new instance |
| `afetch.use(plugin)` | Install a plugin |
| `afetch.task` | Task API for cancellable requests |
| `afetch.defaults` | Default configuration |

### Response Object (`AResponse<T>`)

| Property | Type | Description |
|----------|------|-------------|
| `data` | `T` | Parsed response data |
| `status` | `number` | HTTP status code |
| `statusText` | `string` | HTTP status text |
| `headers` | `Headers` | Response headers |
| `config` | `ResolvedRequestConfig` | Request config |
| `raw` | `Response` | Original Response object |
| `ok` | `boolean` | `status >= 200 && status < 300` |

### Request Task (`RequestTask<T>`)

| Property / Method | Type | Description |
|-------------------|------|-------------|
| `abort()` | `() => void` | Cancel the request |
| `wait()` | `() => Promise<AResponse<T>>` | Wait for the response (throws if aborted) |
| `aborted` | `boolean` | Whether the request has been aborted |
| `done` | `boolean` | Whether the request has completed |

### Error Types (`AFetchErrorType`)

| Code | Description |
|------|-------------|
| `TIMEOUT` | Request timed out |
| `NETWORK` | Network error |
| `ABORT` | Request aborted |
| `HTTP` | Non-2xx response |
| `PARSE` | Response parse error |
| `CONFIG` | Configuration error |

## Project Structure

```
afetch/
├── src/
│   ├── index.ts            # Entry point
│   ├── afetch.ts           # Core implementation
│   ├── types.ts            # Type definitions
│   ├── plugin.ts           # Plugin system (HookRunner)
│   ├── events.ts           # Event emitter
│   ├── error.ts            # AFetchError class
│   ├── utils.ts            # Utilities
│   └── plugins/
│       ├── index.ts        # Plugin exports
│       ├── retry.ts        # Retry plugin
│       └── event-bus.ts    # Event bus plugin
├── test/
│   ├── afetch.test.ts      # Unit tests
│   └── coverage.test.ts    # Coverage tests
├── examples/
│   ├── basic.ts            # Basic usage
│   ├── plugins.ts          # Plugin examples
│   └── task.ts             # Task API examples
├── .github/
│   └── workflows/
│       └── publish.yml     # CI/CD
├── package.json
├── tsconfig.json
└── README.md
```

## License

[MIT](./LICENSE)

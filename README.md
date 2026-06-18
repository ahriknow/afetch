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
npm install @ahriknow/afetch
```

## Quick Start

```typescript
import { afetch } from '@ahriknow/afetch';

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
import { createInstance } from '@ahriknow/afetch';

const api = createInstance({
    baseURL: 'https://api.example.com',
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

const { data: users } = await api.get<User[]>('/users');
const { data: user } = await api.post<User>('/users', { name: 'John' });
```

## Built-in Plugins

### Retry Plugin

```typescript
import { createRetryPlugin } from '@ahriknow/afetch';

const api = createInstance({ baseURL: 'https://api.example.com' });

// Plugin-level defaults — all requests inherit these
api.use(createRetryPlugin({
    maxRetries: 3,
    delay: 1000,
    retryOn: [500, 502, 503, 504],
}));

// Uses plugin defaults (retries 3 times on 5xx errors)
await api.get('/api/data');

// Override per-request
await api.get('/api/critical', {
    meta: { retry: { maxRetries: 5, delay: 2000 } },
});

// Exponential backoff
api.use(createRetryPlugin({
    maxRetries: 5,
    delay: (attempt) => Math.pow(2, attempt) * 1000,
}));

// Advanced: hook + call for token refresh on 401
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

// Custom condition function per-request
await api.get('/api/data', {
    meta: {
        retry: {
            condition: (attempt, error) => error.status === 503 && attempt < 2,
        },
    },
});
```

### Event Bus Plugin

```typescript
import { createEventBusPlugin } from '@ahriknow/afetch';

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

### Queue Plugin

Controls concurrent request execution automatically. Just install the plugin and all requests are concurrency-limited:

```typescript
import { createQueuePlugin } from '@ahriknow/afetch';

const queue = createQueuePlugin({ maxConcurrent: 3 });
api.use(queue);

// All requests are automatically queued — max 3 run at a time
const results = await Promise.all(
    urls.map(url => api.get(url))
);

console.log('Running:', queue.pending);
console.log('Waiting:', queue.queued);
queue.clear(); // reject all waiting
```

### Cache Plugin

Caches GET responses automatically:

```typescript
import { createCachePlugin } from '@ahriknow/afetch';

api.use(createCachePlugin({
    maxAge: 30_000,
    maxSize: 50,
    // Optional: per-request cache decision
    shouldCache: (config, response) => {
        if (response.status >= 400) return false;
        if (config.url.startsWith('/users')) return { maxAge: 60_000 };
        return true; // use default maxAge
    },
}));

// First call — network request
const users1 = await api.get('/users');

// Second call — served from cache (no network)
const users2 = await api.get('/users');

// POST requests are never cached
await api.post('/users', { name: 'John' });
```

### Writing Custom Plugins

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

### Plugin Lifecycle Hooks

| Hook | When | Return |
|------|------|--------|
| `beforeRequest` | Before sending request | `AResponse` (cache hit) or `void` |
| `afterResponse` | After receiving response | `AResponse` (replace) or `void` |
| `onError` | On request error | `AResponse` (retry/replace) or `void` (propagate) |

Plugins are installed once per instance — calling `use()` with the same plugin name is a no-op.

## Documentation

| Topic | Description |
|-------|-------------|
| [Error Handling](./docs/en/error-handling.md) | AFetchError, error types, and error handling patterns |
| [Request Cancellation](./docs/en/cancellation.md) | Task API and AbortController |
| [Transforms](./docs/en/transforms.md) | Request and response data transformation |
| [TypeScript Support](./docs/en/typescript.md) | Type definitions and generic support |
| [Configuration](./docs/en/configuration.md) | Instance and per-request configuration options |
| [API Reference](./docs/en/api-reference.md) | Complete API reference |

## License

[MIT](./LICENSE)

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

## Documentation

| Topic | Description |
|-------|-------------|
| [Plugins](./docs/en/plugins.md) | Built-in plugins (Retry, Event Bus, Queue, Cache) and custom plugin development |
| [Error Handling](./docs/en/error-handling.md) | AFetchError, error types, and error handling patterns |
| [Request Cancellation](./docs/en/cancellation.md) | Task API and AbortController |
| [Transforms](./docs/en/transforms.md) | Request and response data transformation |
| [TypeScript Support](./docs/en/typescript.md) | Type definitions and generic support |
| [Configuration](./docs/en/configuration.md) | Instance and per-request configuration options |
| [API Reference](./docs/en/api-reference.md) | Complete API reference |

## License

[MIT](./LICENSE)

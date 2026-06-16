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

## 文档

| 主题 | 说明 |
|------|------|
| [插件系统](./docs/zh-CN/plugins.md) | 内置插件（重试、事件总线、队列、缓存）和自定义插件开发 |
| [错误处理](./docs/zh-CN/error-handling.md) | AFetchError、错误类型和错误处理模式 |
| [取消请求](./docs/zh-CN/cancellation.md) | Task API 和 AbortController |
| [数据转换](./docs/zh-CN/transforms.md) | 请求和响应数据转换 |
| [TypeScript 支持](./docs/zh-CN/typescript.md) | 类型定义和泛型支持 |
| [配置](./docs/zh-CN/configuration.md) | 实例和单次请求配置选项 |
| [API 参考](./docs/zh-CN/api-reference.md) | 完整 API 参考 |

## 许可证

[MIT](./LICENSE)

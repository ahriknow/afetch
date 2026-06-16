# TypeScript 支持

[← 返回 README](../../README_zh-CN.md)

afetch 为所有 API 方法提供完整的泛型类型支持。

## 类型化响应

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

## 插件类型

```typescript
import type { AFetchPlugin, AFetchPluginApi } from '@ahriknow/afetch';
import type { EventBusPlugin } from '@ahriknow/afetch';
import type { RetryOptions, QueueOptions, CacheOptions } from '@ahriknow/afetch';
```

## 错误类型

```typescript
import { AFetchError, AFetchErrorType } from '@ahriknow/afetch';
import type { AFetchConfig, AResponse, ResolvedRequestConfig } from '@ahriknow/afetch';
```

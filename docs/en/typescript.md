# TypeScript Support

[← Back to README](../../README.md)

afetch provides full generic type support for all API methods.

## Typed Responses

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

## Plugin Types

```typescript
import type { AFetchPlugin, AFetchPluginApi } from '@ahriknow/afetch';
import type { EventBusPlugin } from '@ahriknow/afetch';
import type { RetryOptions, QueueOptions, CacheOptions } from '@ahriknow/afetch';
```

## Error Types

```typescript
import { AFetchError, AFetchErrorType } from '@ahriknow/afetch';
import type { AFetchConfig, AResponse, ResolvedRequestConfig } from '@ahriknow/afetch';
```

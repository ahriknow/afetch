# Request & Response Transforms

[← Back to README](../../README.md)

Transforms allow you to modify request data before sending and response data after receiving.

## Request Transforms

```typescript
await api.post('/api/data', rawData, {
    transformRequest: (data) => ({
        ...(data as object),
        timestamp: Date.now(),
    }),
});
```

## Response Transforms

```typescript
const { data } = await api.get<Item[]>('/api/items', {
    transformResponse: (data) => (data as any).items,
});
```

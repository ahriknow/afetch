# 请求与响应转换

[← 返回 README](../../README_zh-CN.md)

转换允许你在发送前修改请求数据，在接收后修改响应数据。

## 请求转换

```typescript
await api.post('/api/data', rawData, {
    transformRequest: (data) => ({
        ...(data as object),
        timestamp: Date.now(),
    }),
});
```

## 响应转换

```typescript
const { data } = await api.get<Item[]>('/api/items', {
    transformResponse: (data) => (data as any).items,
});
```

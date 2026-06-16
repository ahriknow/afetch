# 配置

[← 返回 README](../../README_zh-CN.md)

## 实例配置

```typescript
const api = createInstance({
    baseURL: 'https://api.example.com',  // 基础 URL
    timeout: 10000,                       // 默认超时（毫秒）
    headers: {                            // 默认请求头
        'Content-Type': 'application/json',
    },
    responseType: 'json',                 // 默认响应类型
    cache: 'default',                     // 请求缓存模式
    credentials: 'same-origin',           // 凭证模式
    throwOnError: true,                   // 非 2xx 抛出错误（默认 true）
    fetchAdapter: customFetch,            // 自定义 fetch 实现
    plugins: [createRetryPlugin()],       // 安装插件
});
```

## 单次请求配置

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

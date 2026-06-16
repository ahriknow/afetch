# Configuration

[← Back to README](../../README.md)

## Instance Configuration

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

## Per-request Options

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

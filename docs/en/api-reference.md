# API Reference

[← Back to README](../../README.md)

## Instance Methods

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

## Response Object (`AResponse<T>`)

| Property | Type | Description |
|----------|------|-------------|
| `data` | `T` | Parsed response data |
| `status` | `number` | HTTP status code |
| `statusText` | `string` | HTTP status text |
| `headers` | `Headers` | Response headers |
| `config` | `ResolvedRequestConfig` | Request config |
| `raw` | `Response` | Original Response object |
| `ok` | `boolean` | `status >= 200 && status < 300` |

## Request Task (`RequestTask<T>`)

| Property / Method | Type | Description |
|-------------------|------|-------------|
| `abort()` | `() => void` | Cancel the request |
| `wait()` | `() => Promise<AResponse<T>>` | Wait for the response (throws if aborted) |
| `aborted` | `boolean` | Whether the request has been aborted |
| `done` | `boolean` | Whether the request has completed |

## Error Types (`AFetchErrorType`)

| Code | Description |
|------|-------------|
| `TIMEOUT` | Request timed out |
| `NETWORK` | Network error |
| `ABORT` | Request aborted |
| `HTTP` | Non-2xx response |
| `PARSE` | Response parse error |
| `CONFIG` | Configuration error |

## SSE Module (`@ahriknow/afetch/sse`)

### Client Methods

| Method | Description |
|--------|-------------|
| `createSSE(url, options?)` | Create an SSE client instance |
| `createAutoReconnectPlugin(options?)` | Create an auto-reconnect plugin |
| `sse.connect()` | Open the SSE connection |
| `sse.close()` | Close the connection and stop reconnects |
| `sse.use(plugin)` | Install a plugin |

### SSE Client Properties

| Property | Type | Description |
|----------|------|-------------|
| `sse.state` | `SSEState` | Connection state: `CONNECTING`, `OPEN`, `CLOSED` |
| `sse.url` | `string` | Full connection URL |
| `sse.reconnectCount` | `number` | Number of successful reconnections |
| `sse.defaults` | `SSEConfig` | Current configuration (readonly) |

### SSE Event (`SSEEvent`)

| Property | Type | Description |
|----------|------|-------------|
| `event` | `string \| undefined` | Event type (default: `'message'`) |
| `data` | `string` | Event data |
| `id` | `string \| undefined` | Last event ID |
| `retry` | `number \| undefined` | Reconnection time in ms |

### SSE Error Types (`SSEErrorType`)

| Code | Description |
|------|-------------|
| `NETWORK` | Network or HTTP error |
| `PARSE` | SSE data parsing error |
| `TIMEOUT` | Connection timeout |
| `CONFIG` | Configuration error |

### SSE Plugin Hooks

| Hook | Context | Return |
|------|---------|--------|
| `connect` | `{ config, url }` | `void` |
| `message` | `{ config, event }` | `void` |
| `error` | `{ config, error, attempt }` | `false` to prevent reconnect, `void` to allow |
| `close` | `{ config, reconnectCount }` | `void` |

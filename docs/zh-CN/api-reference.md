# API 参考

[← 返回 README](../../README_zh-CN.md)

## 实例方法

| 方法 | 说明 |
|------|------|
| `afetch.get<T>(url, options?)` | GET 请求 |
| `afetch.post<T>(url, data?, options?)` | POST 请求 |
| `afetch.put<T>(url, data?, options?)` | PUT 请求 |
| `afetch.delete<T>(url, options?)` | DELETE 请求 |
| `afetch.patch<T>(url, data?, options?)` | PATCH 请求 |
| `afetch.head<T>(url, options?)` | HEAD 请求 |
| `afetch.options<T>(url, options?)` | OPTIONS 请求 |
| `afetch.request<T>(url, options?)` | 自定义方法请求 |
| `afetch.create(config?)` | 创建新实例 |
| `afetch.use(plugin)` | 安装插件 |
| `afetch.task` | Task API，用于可取消的请求 |
| `afetch.defaults` | 默认配置 |

## 响应对象 (`AResponse<T>`)

| 属性 | 类型 | 说明 |
|------|------|------|
| `data` | `T` | 解析后的响应数据 |
| `status` | `number` | HTTP 状态码 |
| `statusText` | `string` | HTTP 状态文本 |
| `headers` | `Headers` | 响应头 |
| `config` | `ResolvedRequestConfig` | 请求配置 |
| `raw` | `Response` | 原始 Response 对象 |
| `ok` | `boolean` | `status >= 200 && status < 300` |

## 请求任务 (`RequestTask<T>`)

| 属性 / 方法 | 类型 | 说明 |
|-------------|------|------|
| `abort()` | `() => void` | 取消请求 |
| `wait()` | `() => Promise<AResponse<T>>` | 等待响应（取消后调用会抛出错误）|
| `aborted` | `boolean` | 请求是否已被取消 |
| `done` | `boolean` | 请求是否已完成 |

## 错误类型 (`AFetchErrorType`)

| 代码 | 说明 |
|------|------|
| `TIMEOUT` | 请求超时 |
| `NETWORK` | 网络错误 |
| `ABORT` | 请求被取消 |
| `HTTP` | 非 2xx 响应 |
| `PARSE` | 响应解析错误 |
| `CONFIG` | 配置错误 |

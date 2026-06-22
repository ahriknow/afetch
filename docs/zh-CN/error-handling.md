# 错误处理

[← 返回 README](../../README_zh-CN.md)

afetch 抛出 `AFetchError` 实例，包含结构化的错误信息。

```typescript
import { AFetchError, AFetchErrorType } from '@ahriknow/afetch';

try {
    await api.get('/api/data');
} catch (error) {
    if (error instanceof AFetchError) {
        switch (error.code) {
            case AFetchErrorType.TIMEOUT:
                console.log('请求超时');
                break;
            case AFetchErrorType.HTTP:
                console.log(`HTTP ${error.status}: ${error.message}`);
                break;
            case AFetchErrorType.NETWORK:
                console.log('网络错误');
                break;
            case AFetchErrorType.ABORT:
                console.log('请求已取消');
                break;
            case AFetchErrorType.CONFIG:
                console.log('配置错误');
                break;
            case AFetchErrorType.PARSE:
                console.log('响应解析错误');
                break;
        }
    }
}
```

## 错误类型

| 代码 | 说明 |
|------|------|
| `TIMEOUT` | 请求超时 |
| `NETWORK` | 网络错误 |
| `ABORT` | 请求被取消 |
| `HTTP` | 非 2xx 响应 |
| `PARSE` | 响应解析错误 |
| `CONFIG` | 配置错误 |

## 禁用错误抛出

可以禁用非 2xx 响应时的自动错误抛出：

```typescript
const response = await api.get('/api/data', {
    throwOnError: false,
});

if (response.ok) {
    console.log(response.data);
} else {
    console.error(`HTTP ${response.status}`);
}
```

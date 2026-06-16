# Error Handling

[← Back to README](../../README.md)

afetch throws `AFetchError` instances with structured error information.

```typescript
import { AFetchError, AFetchErrorType } from '@ahriknow/afetch';

try {
    await api.get('/api/data');
} catch (error) {
    if (error instanceof AFetchError) {
        switch (error.code) {
            case AFetchErrorType.TIMEOUT:
                console.log('Request timed out');
                break;
            case AFetchErrorType.HTTP:
                console.log(`HTTP ${error.status}: ${error.message}`);
                break;
            case AFetchErrorType.NETWORK:
                console.log('Network error');
                break;
            case AFetchErrorType.ABORT:
                console.log('Request aborted');
                break;
        }
    }
}
```

## Error Types

| Code | Description |
|------|-------------|
| `TIMEOUT` | Request timed out |
| `NETWORK` | Network error |
| `ABORT` | Request aborted |
| `HTTP` | Non-2xx response |
| `PARSE` | Response parse error |
| `CONFIG` | Configuration error |

## Disabling Error Throwing

You can disable automatic error throwing for non-2xx responses:

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

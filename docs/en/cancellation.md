# Request Cancellation

[← Back to README](../../README.md)

afetch supports two approaches for cancelling requests.

## Task API (Recommended)

The Task API starts the request immediately and returns a handle to control it:

```typescript
// Create a task — request starts immediately
const task = api.task.get('/api/data', {
    headers: { Authorization: 'Bearer token' },
});

// Check status
console.log(task.done);    // false
console.log(task.aborted); // false

// Cancel the request
task.abort();
console.log(task.aborted); // true

// Wait for response — throws AFetchError(ABORT) if cancelled
try {
    const response = await task.wait();
    console.log(response.data);
} catch (error) {
    if (error.code === 'EABORT') {
        console.log('Request was aborted');
    }
}
```

Supports all HTTP methods:

```typescript
const getTask = api.task.get('/api/users');
const postTask = api.task.post('/api/users', { name: 'John' });
const putTask = api.task.put('/api/users/1', { name: 'Updated' });
const deleteTask = api.task.delete('/api/users/1');
const patchTask = api.task.patch('/api/users/1', { name: 'Patched' });
```

## AbortController

You can also use the standard `AbortController` approach:

```typescript
const controller = new AbortController();

const { data } = await api.get('/api/data', {
    signal: controller.signal,
    timeout: 5000, // auto-abort after 5s
});

// Cancel manually
controller.abort();
```

## Combining Abort Signals

Use `AbortSignal.any()` to combine cancellation sources. For example, either a user cancellation or a 5-second timeout will abort the request:

```typescript
const controller = new AbortController();
const signal = AbortSignal.any([
    controller.signal,
    AbortSignal.timeout(5000),
]);

try {
    await api.get('/api/data', { signal });
} catch (error) {
    if (error.code === 'ETIMEDOUT') {
        console.log('Request timed out');
    } else if (error.code === 'EABORT') {
        console.log('Request was cancelled');
    }
}
```

afetch recognizes timeout reasons from `AbortSignal.timeout()` and classifies them as `ETIMEDOUT`. Internally, signal composition falls back to a compatibility implementation when `AbortSignal.any()` is unavailable. Calling `AbortSignal.any()` directly still requires runtime support.

## Timeout

Requests support automatic timeout via the `timeout` option:

```typescript
// Auto-abort after 5 seconds
const { data } = await api.get('/api/data', { timeout: 5000 });
```

# 取消请求

[← 返回 README](../../README_zh-CN.md)

afetch 支持两种取消请求的方式。

## Task API（推荐）

Task API 会立即发起请求，并返回一个句柄来控制请求：

```typescript
// 创建任务——请求立即发起
const task = api.task.get('/api/data', {
    headers: { Authorization: 'Bearer token' },
});

// 检查状态
console.log(task.done);    // false
console.log(task.aborted); // false

// 取消请求
task.abort();
console.log(task.aborted); // true

// 等待响应——如果已取消则抛出 AFetchError(ABORT)
try {
    const response = await task.wait();
    console.log(response.data);
} catch (error) {
    if (error.code === 'EABORT') {
        console.log('请求已取消');
    }
}
```

支持所有 HTTP 方法：

```typescript
const getTask = api.task.get('/api/users');
const postTask = api.task.post('/api/users', { name: '张三' });
const putTask = api.task.put('/api/users/1', { name: '已更新' });
const deleteTask = api.task.delete('/api/users/1');
const patchTask = api.task.patch('/api/users/1', { name: '已修改' });
```

## AbortController

也可以使用标准的 AbortController 方式：

```typescript
const controller = new AbortController();

const { data } = await api.get('/api/data', {
    signal: controller.signal,
    timeout: 5000, // 5 秒后自动取消
});

// 手动取消
controller.abort();
```

## 超时

请求支持通过 `timeout` 选项自动超时：

```typescript
// 5 秒后自动取消
const { data } = await api.get('/api/data', { timeout: 5000 });
```

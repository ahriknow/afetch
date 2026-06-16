/**
 * afetch - Task API Examples
 */

import { createInstance, AFetchError, AFetchErrorType } from '../src/index.js';

// ─── Example 1: Basic Task API ─────────────────────────────────

async function basicTask() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    // Create a task — request starts immediately
    const task = api.task.get<{ id: number; name: string }[]>('/users');

    // Check status
    console.log('Done:', task.done);      // false
    console.log('Aborted:', task.aborted); // false

    // Wait for response
    const response = await task.wait();
    console.log('Users:', response.data);

    // After completion
    console.log('Done:', task.done); // true
}

// ─── Example 2: Cancel a task ──────────────────────────────────

async function cancelTask() {
    const api = createInstance({
        baseURL: 'https://httpbin.org',
    });

    // Create a task with a slow endpoint
    const task = api.task.get('/delay/10');

    // Cancel immediately
    task.abort();
    console.log('Aborted:', task.aborted); // true

    // Wait will throw AFetchError with ABORT code
    try {
        await task.wait();
    } catch (error) {
        if (error instanceof AFetchError && error.code === AFetchErrorType.ABORT) {
            console.log('Request was cancelled');
        }
    }
}

// ─── Example 3: Task with POST ─────────────────────────────────

async function postTask() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    const task = api.task.post<{ id: number }>('/users', {
        name: 'John Doe',
        email: 'john@example.com',
    });

    const response = await task.wait();
    console.log('Created:', response.data);
}

// ─── Example 4: Task with all HTTP methods ─────────────────────

async function allMethods() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    // GET
    const getTask = api.task.get('/users/1');
    const getRes = await getTask.wait();
    console.log('GET:', getRes.data);

    // POST
    const postTask = api.task.post('/users', { name: 'New User' });
    const postRes = await postTask.wait();
    console.log('POST:', postRes.data);

    // PUT
    const putTask = api.task.put('/users/1', { name: 'Updated' });
    const putRes = await putTask.wait();
    console.log('PUT:', putRes.data);

    // PATCH
    const patchTask = api.task.patch('/users/1', { name: 'Patched' });
    const patchRes = await patchTask.wait();
    console.log('PATCH:', patchRes.data);

    // DELETE
    const deleteTask = api.task.delete('/users/1');
    const deleteRes = await deleteTask.wait();
    console.log('DELETE:', deleteRes.status);
}

// ─── Example 5: Task with options ──────────────────────────────

async function taskWithOptions() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    const task = api.task.get('/users', {
        headers: { 'X-Custom': 'value' },
        params: { _limit: 3 },
        timeout: 5000,
    });

    const response = await task.wait();
    console.log('Users:', response.data);
}

// ─── Example 6: Concurrent tasks ───────────────────────────────

async function concurrentTasks() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    // Start multiple tasks concurrently
    const usersTask = api.task.get('/users');
    const postsTask = api.task.get('/posts');
    const commentsTask = api.task.get('/comments');

    // Wait for all to complete
    const [users, posts, comments] = await Promise.all([
        usersTask.wait(),
        postsTask.wait(),
        commentsTask.wait(),
    ]);

    console.log('Users:', users.data.length);
    console.log('Posts:', posts.data.length);
    console.log('Comments:', comments.data.length);
}

// ─── Run examples ──────────────────────────────────────────────

async function main() {
    console.log('=== Basic Task ===');
    await basicTask();

    console.log('\n=== Cancel Task ===');
    await cancelTask();

    console.log('\n=== POST Task ===');
    await postTask();

    console.log('\n=== Task with Options ===');
    await taskWithOptions();

    console.log('\n=== Concurrent Tasks ===');
    await concurrentTasks();
}

main().catch(console.error);

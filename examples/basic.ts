/**
 * afetch - Basic Usage Examples
 */

import { afetch, createInstance, AFetchError, AFetchErrorType } from '../src/index.js';

// ─── Example 1: Simple GET request ─────────────────────────────

async function simpleGet() {
    const { data } = await afetch.get<{ id: number; name: string }[]>(
        'https://jsonplaceholder.typicode.com/users'
    );
    console.log('Users:', data);
}

// ─── Example 2: POST request with JSON body ────────────────────

async function postRequest() {
    const { data } = await afetch.post<{ id: number }>(
        'https://jsonplaceholder.typicode.com/users',
        {
            name: 'John Doe',
            email: 'john@example.com',
        }
    );
    console.log('Created user:', data);
}

// ─── Example 3: Creating an instance with baseURL ──────────────

async function instanceExample() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
        timeout: 5000,
        headers: {
            'Content-Type': 'application/json',
        },
    });

    const { data: users } = await api.get<Array<{ id: number; name: string }>>('/users');
    console.log('Users:', users);

    const { data: user } = await api.get<{ id: number; name: string }>('/users/1');
    console.log('User 1:', user);
}

// ─── Example 4: Query parameters ───────────────────────────────

async function queryParams() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    const { data } = await api.get<unknown[]>('/posts', {
        params: { userId: 1, _limit: 3 },
    });
    console.log('Posts:', data);
}

// ─── Example 5: Error handling ─────────────────────────────────

async function errorHandling() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    try {
        await api.get('/nonexistent');
    } catch (error) {
        if (error instanceof AFetchError) {
            switch (error.code) {
                case AFetchErrorType.HTTP:
                    console.log(`HTTP Error ${error.status}: ${error.message}`);
                    break;
                case AFetchErrorType.TIMEOUT:
                    console.log('Request timed out');
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
}

// ─── Example 6: Request and response transforms ────────────────

async function transforms() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    // Transform response data
    const { data: titles } = await api.get<string[]>('/posts', {
        transformResponse: (data: unknown) => {
            return (data as Array<{ title: string }>).map((post) => post.title);
        },
    });
    console.log('Post titles:', titles);
}

// ─── Run examples ──────────────────────────────────────────────

async function main() {
    console.log('=== Simple GET ===');
    await simpleGet();

    console.log('\n=== POST Request ===');
    await postRequest();

    console.log('\n=== Instance Example ===');
    await instanceExample();

    console.log('\n=== Query Parameters ===');
    await queryParams();

    console.log('\n=== Error Handling ===');
    await errorHandling();

    console.log('\n=== Transforms ===');
    await transforms();
}

main().catch(console.error);

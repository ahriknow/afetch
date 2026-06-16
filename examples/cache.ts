/**
 * afetch - Cache Plugin Example
 */

import { createInstance, createCachePlugin } from '../src/index.js';

async function cacheExample() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    // Install cache plugin — GET responses are cached automatically
    api.use(createCachePlugin({
        maxAge: 30_000,
        maxSize: 50,
        // Per-request cache decision
        shouldCache: (config, response) => {
            // Don't cache error responses
            if (response.status >= 400) return false;
            // Cache /users for 60 seconds, everything else for 30 seconds
            if (config.url.startsWith('/users')) {
                return { maxAge: 60_000 };
            }
            return true; // use default maxAge
        },
    }));

    // First call — cache miss, network request
    const users1 = await api.get<Array<{ id: number; name: string }>>('/users');
    console.log('Users:', users1.data.length);

    // Second call — cache hit, no network request
    const users2 = await api.get<Array<{ id: number; name: string }>>('/users');
    console.log('Users (cached):', users2.data.length);

    // POST requests are never cached
    await api.post('/users', { name: 'John' });
}

cacheExample().catch(console.error);

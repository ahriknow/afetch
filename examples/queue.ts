/**
 * afetch - Queue Plugin Example
 */

import { createInstance, createQueuePlugin } from '../src/index.js';

async function queueExample() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    // Install queue plugin — all requests are automatically concurrency-limited
    const queuePlugin = createQueuePlugin({ maxConcurrent: 2 });
    api.use(queuePlugin);

    const urls = ['/users/1', '/users/2', '/users/3', '/users/4', '/users/5'];

    // Just use the API normally — concurrency is controlled automatically
    const results = await Promise.all(
        urls.map((url) => api.get<{ id: number; name: string }>(url))
    );

    for (const result of results) {
        console.log(`User: ${result.data.name}`);
    }

    console.log('Pending:', queuePlugin.pending);
    console.log('Queued:', queuePlugin.queued);
}

queueExample().catch(console.error);

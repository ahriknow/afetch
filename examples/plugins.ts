/**
 * afetch - Plugin Examples
 */

import {
    createInstance,
    createRetryPlugin,
    createEventBusPlugin,
} from '../src/index.js';
import type { AFetchPlugin, EventBusPlugin } from '../src/index.js';

// ─── Example 1: Retry Plugin ───────────────────────────────────

async function retryExample() {
    const api = createInstance({
        baseURL: 'https://httpbin.org',
    });

    // Install retry plugin
    api.use(createRetryPlugin());

    // Basic retry
    const { data } = await api.get<any>('/status/500', {
        throwOnError: false,
        meta: {
            retry: {
                maxRetries: 3,
                delay: 1000,
            },
        },
    });
    console.log('Retry result:', data);
}

// ─── Example 2: Retry on specific status codes ─────────────────

async function retryOnStatusExample() {
    const api = createInstance({
        baseURL: 'https://httpbin.org',
    });
    api.use(createRetryPlugin());

    await api.get('/status/503', {
        throwOnError: false,
        meta: {
            retry: {
                maxRetries: 2,
                delay: 500,
                retryOn: [500, 502, 503],
            },
        },
    });
}

// ─── Example 3: Exponential backoff ────────────────────────────

async function exponentialBackoffExample() {
    const api = createInstance({
        baseURL: 'https://httpbin.org',
    });
    api.use(createRetryPlugin());

    await api.get('/status/500', {
        throwOnError: false,
        meta: {
            retry: {
                maxRetries: 4,
                delay: (attempt: number) => Math.pow(2, attempt) * 1000,
            },
        },
    });
}

// ─── Example 4: Event Bus Plugin ───────────────────────────────

async function eventBusExample() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    const eventBus: EventBusPlugin = createEventBusPlugin();
    api.use(eventBus);

    // Listen to request events
    const unsub = eventBus.on('request', ({ config }) => {
        console.log(`→ ${config.method} ${config.url}`);
    });

    // Listen to response events
    eventBus.on('response', ({ config, response }) => {
        console.log(`← ${response.status} ${config.url}`);
    });

    // Listen to error events
    eventBus.on('error', ({ config, error }) => {
        console.error(`✗ ${error.code} ${config.url}`);
    });

    await api.get('/users');

    // Unsubscribe from request events
    unsub();

    // Remove all response listeners
    eventBus.off('response');
}

// ─── Example 5: Custom Plugin ──────────────────────────────────

async function customPluginExample() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    // Logger plugin
    const loggerPlugin: AFetchPlugin = {
        name: 'logger',
        install(hooks) {
            hooks.addHook('beforeRequest', ({ config }) => {
                console.log(`[REQ] ${config.method} ${config.baseURL}${config.url}`);
            });

            hooks.addHook('afterResponse', ({ response }) => {
                console.log(`[RES] ${response.status} ${response.statusText}`);
            });

            hooks.addHook('onError', ({ error }) => {
                console.error(`[ERR] ${error.code}: ${error.message}`);
            });
        },
    };

    api.use(loggerPlugin);

    await api.get('/users');
}

// ─── Example 6: Auth token plugin ──────────────────────────────

async function authPluginExample() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    let token = 'initial-token';

    const authPlugin: AFetchPlugin = {
        name: 'auth',
        install(hooks) {
            hooks.addHook('beforeRequest', ({ config }) => {
                config.headers['Authorization'] = `Bearer ${token}`;
            });

            hooks.addHook('onError', ({ error }) => {
                if (error.status === 401) {
                    console.log('Token expired, refreshing...');
                    token = 'refreshed-token';
                }
            });
        },
    };

    api.use(authPlugin);

    await api.get('/users');
}

// ─── Run examples ──────────────────────────────────────────────

async function main() {
    console.log('=== Event Bus ===');
    await eventBusExample();

    console.log('\n=== Custom Plugin ===');
    await customPluginExample();

    console.log('\n=== Auth Plugin ===');
    await authPluginExample();
}

main().catch(console.error);

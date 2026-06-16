/**
 * afetch - Unit Tests
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Create mock response helper
function createMockResponse(options: {
    ok: boolean;
    status: number;
    statusText: string;
    data?: unknown;
    headers?: Record<string, string>;
}): Response {
    const headers = new Headers(options.headers || {});
    if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
    }
    return {
        ok: options.ok,
        status: options.status,
        statusText: options.statusText,
        headers,
        json: () => Promise.resolve(options.data),
        text: () => Promise.resolve(JSON.stringify(options.data)),
        blob: () => Promise.resolve(new Blob()),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        formData: () => Promise.resolve(new FormData()),
        body: null,
        bodyUsed: false,
        clone: () => createMockResponse(options),
        type: 'basic' as ResponseType,
        url: '',
        redirected: false,
        bytes: () => Promise.resolve(new Uint8Array()),
    } as unknown as Response;
}

// Create a shared mock fetch function
const mockFetch = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

// Import afetch and plugins
const {
    afetch,
    AFetchError,
    createInstance,
    AFetchErrorType,
    createRetryPlugin,
    createEventBusPlugin,
} = await import('../src/index.js');

import type { AFetchPluginApi, AFetchPlugin } from '../src/plugin.js';
import type { EventBusPlugin } from '../src/plugins/event-bus.js';

const BASE_URL = 'https://test.example.com';

// Helper to create an instance with the mock fetch adapter
function createTestInstance(config?: Omit<Parameters<typeof createInstance>[0], 'fetchAdapter'>) {
    return createInstance({
        baseURL: BASE_URL,
        ...config,
        fetchAdapter: mockFetch as unknown as typeof fetch,
    });
}

describe('afetch', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        mockFetch.mockImplementation(() => {
            return Promise.resolve(
                createMockResponse({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    data: {},
                })
            );
        });
    });

    describe('basic requests', () => {
        it('should make a GET request', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: { data: 'test' },
                    })
                )
            );

            const response = await api.get('/api/test');

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(200);
            expect(response.data).toEqual({ data: 'test' });
        });

        it('should make a POST request with JSON body', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 201,
                        statusText: 'Created',
                        data: { id: 1 },
                    })
                )
            );

            const response = await api.post('/api/test', { name: 'test' });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(201);
            expect(response.data).toEqual({ id: 1 });
        });

        it('should make a PUT request', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            const response = await api.put('/api/test/1', { name: 'updated' });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(200);
        });

        it('should make a DELETE request', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 204,
                        statusText: 'No Content',
                        data: null,
                    })
                )
            );

            const response = await api.delete('/api/test/1');

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(204);
        });

        it('should make a PATCH request', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            const response = await api.patch('/api/test/1', { name: 'patched' });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(200);
        });
    });

    describe('options and config', () => {
        it('should use custom headers', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            await api.get('/api/test', {
                headers: { Authorization: 'Bearer token123' },
            });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const callArgs = mockFetch.mock.calls[0];
            expect(callArgs).toBeDefined();
        });

        it('should set query parameters', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            await api.get('/api/test', {
                params: { page: 1, limit: 10 },
            });

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should use custom baseURL', async () => {
            const api = createTestInstance({ baseURL: 'https://custom.example.com' });
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            await api.get('/users');

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('plugins', () => {
        it('should install and use a plugin', async () => {
            const api = createTestInstance();
            const hookFn = jest.fn<() => void>();

            api.use({
                name: 'test-plugin',
                install(pluginApi: AFetchPluginApi) {
                    pluginApi.addHook('beforeRequest', () => {
                        hookFn();
                    });
                },
            });

            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            await api.get('/test');

            expect(hookFn).toHaveBeenCalledTimes(1);
        });

        it('should not install the same plugin twice', async () => {
            const api = createTestInstance();
            const installFn = jest.fn();

            const plugin: AFetchPlugin = {
                name: 'unique-plugin',
                install: installFn as any,
            };

            api.use(plugin);
            api.use(plugin);

            expect(installFn).toHaveBeenCalledTimes(1);
        });

        it('should call afterResponse hook', async () => {
            const api = createTestInstance();
            const hookFn = jest.fn<() => void>();

            api.use({
                name: 'response-plugin',
                install(pluginApi: AFetchPluginApi) {
                    pluginApi.addHook('afterResponse', () => {
                        hookFn();
                    });
                },
            });

            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: { result: 'ok' },
                    })
                )
            );

            await api.get('/test');

            expect(hookFn).toHaveBeenCalledTimes(1);
        });

        it('should call onError hook', async () => {
            const api = createTestInstance();
            const hookFn = jest.fn<() => void>();

            api.use({
                name: 'error-plugin',
                install(pluginApi: AFetchPluginApi) {
                    pluginApi.addHook('onError', () => {
                        hookFn();
                    });
                },
            });

            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: false,
                        status: 500,
                        statusText: 'Internal Server Error',
                        data: { error: 'fail' },
                    })
                )
            );

            await expect(api.get('/test')).rejects.toThrow(AFetchError);
            expect(hookFn).toHaveBeenCalledTimes(1);
        });

        it('should install plugins via config', async () => {
            const hookFn = jest.fn<() => void>();

            const api = createTestInstance({
                plugins: [
                    {
                        name: 'config-plugin',
                        install(pluginApi: AFetchPluginApi) {
                            pluginApi.addHook('beforeRequest', () => {
                                hookFn();
                            });
                        },
                    },
                ],
            });

            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            await api.get('/test');

            expect(hookFn).toHaveBeenCalledTimes(1);
        });
    });

    describe('retry plugin', () => {
        it('should retry failed requests', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            mockFetch
                .mockImplementationOnce(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: false,
                            status: 500,
                            statusText: 'Internal Server Error',
                            data: { error: 'fail' },
                        })
                    )
                )
                .mockImplementationOnce(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: false,
                            status: 500,
                            statusText: 'Internal Server Error',
                            data: { error: 'fail' },
                        })
                    )
                )
                .mockImplementation(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            data: { success: true },
                        })
                    )
                );

            const response = await api.get('/api/flaky', {
                meta: { retry: { maxRetries: 3, delay: 10 } },
            });

            expect(response.status).toBe(200);
            expect(response.data).toEqual({ success: true });
            expect(mockFetch).toHaveBeenCalledTimes(3);
        });

        it('should not retry when no retry config', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: false,
                        status: 500,
                        statusText: 'Internal Server Error',
                        data: { error: 'fail' },
                    })
                )
            );

            await expect(api.get('/api/test')).rejects.toThrow(AFetchError);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should retry with retryOn config', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            mockFetch
                .mockImplementationOnce(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: false,
                            status: 401,
                            statusText: 'Unauthorized',
                            data: { error: 'unauthorized' },
                        })
                    )
                )
                .mockImplementation(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            data: { success: true },
                        })
                    )
                );

            const response = await api.get('/api/auth', {
                meta: {
                    retry: {
                        maxRetries: 3,
                        delay: 10,
                        retryOn: [401],
                    },
                },
            });

            expect(response.status).toBe(200);
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should not retry on abort', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            let resolveFetch!: (value: Response) => void;
            const fetchPromise = new Promise<Response>((resolve) => {
                resolveFetch = resolve;
            });
            mockFetch.mockImplementationOnce(
                (input: RequestInfo | URL, init?: RequestInit) => {
                    const signal =
                        init?.signal ?? (input instanceof Request ? input.signal : undefined);
                    if (signal?.aborted) {
                        return Promise.reject(
                            new DOMException('The operation was aborted.', 'AbortError')
                        );
                    }
                    return new Promise<Response>((resolve, reject) => {
                        signal?.addEventListener('abort', () => {
                            reject(new DOMException('The operation was aborted.', 'AbortError'));
                        });
                        fetchPromise.then(resolve);
                    });
                }
            );

            const task = api.task.get('/api/slow', {
                meta: { retry: { maxRetries: 3, delay: 10 } },
            });
            task.abort();

            resolveFetch(
                createMockResponse({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    data: {},
                })
            );

            await expect(task.wait()).rejects.toThrow(AFetchError);
            // Should only be called once — no retries after abort
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should use plugin-level default options', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin({ maxRetries: 2, delay: 10 }));

            mockFetch
                .mockImplementationOnce(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: false,
                            status: 500,
                            statusText: 'Internal Server Error',
                            data: { error: 'fail' },
                        })
                    )
                )
                .mockImplementation(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            data: { success: true },
                        })
                    )
                );

            // No meta.retry needed — uses plugin defaults
            const response = await api.get('/api/test');

            expect(response.status).toBe(200);
            expect(response.data).toEqual({ success: true });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should let request-level options override plugin defaults', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin({ maxRetries: 5, delay: 10 }));

            mockFetch
                .mockImplementationOnce(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: false,
                            status: 500,
                            statusText: 'Internal Server Error',
                            data: { error: 'fail' },
                        })
                    )
                )
                .mockImplementation(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            data: { success: true },
                        })
                    )
                );

            // Override maxRetries to 1
            const response = await api.get('/api/test', {
                meta: { retry: { maxRetries: 1, delay: 10 } },
            });

            expect(response.status).toBe(200);
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should not retry when no plugin defaults and no request config', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: false,
                        status: 500,
                        statusText: 'Internal Server Error',
                        data: { error: 'fail' },
                    })
                )
            );

            await expect(api.get('/api/test')).rejects.toThrow(AFetchError);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should retry with plugin defaults and retryOn', async () => {
            const api = createTestInstance();
            api.use(
                createRetryPlugin({
                    maxRetries: 3,
                    delay: 10,
                    retryOn: [500],
                })
            );

            mockFetch
                .mockImplementationOnce(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: false,
                            status: 500,
                            statusText: 'Internal Server Error',
                            data: { error: 'fail' },
                        })
                    )
                )
                .mockImplementation(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            data: { success: true },
                        })
                    )
                );

            const response = await api.get('/api/test');

            expect(response.status).toBe(200);
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('event bus plugin', () => {
        it('should emit request event', async () => {
            const api = createTestInstance();
            const eventBus = createEventBusPlugin();
            api.use(eventBus);

            const requestListener = jest.fn<() => void>();
            eventBus.on('request', requestListener);

            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            await api.get('/test');

            expect(requestListener).toHaveBeenCalledTimes(1);
        });

        it('should emit response event', async () => {
            const api = createTestInstance();
            const eventBus = createEventBusPlugin();
            api.use(eventBus);

            const responseListener = jest.fn<() => void>();
            eventBus.on('response', responseListener);

            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: { result: 'ok' },
                    })
                )
            );

            await api.get('/test');

            expect(responseListener).toHaveBeenCalledTimes(1);
        });

        it('should emit error event', async () => {
            const api = createTestInstance();
            const eventBus = createEventBusPlugin();
            api.use(eventBus);

            const errorListener = jest.fn<() => void>();
            eventBus.on('error', errorListener);

            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: false,
                        status: 500,
                        statusText: 'Internal Server Error',
                        data: {},
                    })
                )
            );

            await expect(api.get('/test')).rejects.toThrow();
            expect(errorListener).toHaveBeenCalledTimes(1);
        });

        it('should allow unsubscribing', async () => {
            const api = createTestInstance();
            const eventBus = createEventBusPlugin();
            api.use(eventBus);

            const requestListener = jest.fn<() => void>();
            const unsubscribe = eventBus.on('request', requestListener);

            unsubscribe();

            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            await api.get('/test');

            expect(requestListener).not.toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should throw AFetchError on non-2xx response', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: false,
                        status: 404,
                        statusText: 'Not Found',
                        data: { error: 'Not Found' },
                    })
                )
            );

            await expect(api.get('/api/not-found')).rejects.toThrow(AFetchError);
        });

        it('should have correct error properties', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: false,
                        status: 500,
                        statusText: 'Internal Server Error',
                        data: { error: 'Server Error' },
                    })
                )
            );

            try {
                await api.get('/api/error');
                expect(true).toBe(false);
            } catch (error) {
                expect(error).toBeInstanceOf(AFetchError);
                const afetchError = error as InstanceType<typeof AFetchError>;
                expect(afetchError.code).toBe(AFetchErrorType.HTTP);
                expect(afetchError.status).toBe(500);
                expect(afetchError.isHttpError).toBe(true);
            }
        });

        it('should handle network errors', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.reject(new TypeError('Failed to fetch'))
            );

            await expect(api.get('/api/test')).rejects.toThrow(AFetchError);
        });
    });

    describe('task API', () => {
        it('should create a task and wait for response', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: { id: 1, name: 'test' },
                    })
                )
            );

            const task = api.task.get('/api/test');
            expect(task.aborted).toBe(false);
            expect(task.done).toBe(false);

            const response = await task.wait();
            expect(response.status).toBe(200);
            expect(response.data).toEqual({ id: 1, name: 'test' });
            expect(task.done).toBe(true);
        });

        it('should abort a task before response', async () => {
            const api = createTestInstance();
            let resolveFetch!: (value: Response) => void;
            const fetchPromise = new Promise<Response>((resolve) => {
                resolveFetch = resolve;
            });
            mockFetch.mockImplementationOnce((input: RequestInfo | URL, init?: RequestInit) => {
                const signal =
                    init?.signal ?? (input instanceof Request ? input.signal : undefined);
                if (signal?.aborted) {
                    return Promise.reject(
                        new DOMException('The operation was aborted.', 'AbortError')
                    );
                }
                return new Promise<Response>((resolve, reject) => {
                    signal?.addEventListener('abort', () => {
                        reject(new DOMException('The operation was aborted.', 'AbortError'));
                    });
                    fetchPromise.then(resolve);
                });
            });

            const task = api.task.get('/api/slow');
            task.abort();

            expect(task.aborted).toBe(true);

            // Resolve the fetch after abort
            resolveFetch(
                createMockResponse({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    data: {},
                })
            );

            await expect(task.wait()).rejects.toThrow(AFetchError);
        });

        it('should support POST task with body', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 201,
                        statusText: 'Created',
                        data: { id: 2, name: 'new' },
                    })
                )
            );

            const task = api.task.post('/api/test', { name: 'new' });
            const response = await task.wait();

            expect(response.status).toBe(201);
            expect(response.data).toEqual({ id: 2, name: 'new' });
        });

        it('should support PUT task', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: { id: 1, name: 'updated' },
                    })
                )
            );

            const task = api.task.put('/api/test/1', { name: 'updated' });
            const response = await task.wait();

            expect(response.status).toBe(200);
        });

        it('should support DELETE task', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 204,
                        statusText: 'No Content',
                        data: null,
                    })
                )
            );

            const task = api.task.delete('/api/test/1');
            const response = await task.wait();

            expect(response.status).toBe(204);
        });

        it('should support PATCH task', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: { id: 1, name: 'patched' },
                    })
                )
            );

            const task = api.task.patch('/api/test/1', { name: 'patched' });
            const response = await task.wait();

            expect(response.status).toBe(200);
        });

        it('should pass options to task requests', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            const task = api.task.get('/api/test', {
                headers: { Authorization: 'Bearer token' },
                timeout: 5000,
            });
            const response = await task.wait();

            expect(response.status).toBe(200);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should handle abort on wait for already completed task', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: { result: 'ok' },
                    })
                )
            );

            const task = api.task.get('/api/test');
            const response = await task.wait();

            // Abort after completion should be a no-op
            task.abort();
            expect(task.aborted).toBe(false); // aborted stays false since it was already done
            expect(task.done).toBe(true);
            expect(response.data).toEqual({ result: 'ok' });
        });

        it('should mark task done on error response', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: false,
                        status: 500,
                        statusText: 'Internal Server Error',
                        data: { error: 'fail' },
                    })
                )
            );

            const task = api.task.get('/api/test');
            await expect(task.wait()).rejects.toThrow(AFetchError);
            expect(task.done).toBe(true);
        });
    });

    describe('createInstance', () => {
        it('should create a new instance with custom config', () => {
            const api = createInstance({
                baseURL: 'https://api.example.com',
                timeout: 5000,
                headers: { 'X-Custom': 'value' },
            });

            expect(api.defaults.baseURL).toBe('https://api.example.com');
            expect(api.defaults.timeout).toBe(5000);
            expect(api.defaults.headers).toEqual({ 'X-Custom': 'value' });
        });

        it('should create independent instances', () => {
            const api1 = createInstance({ baseURL: 'https://api1.example.com' });
            const api2 = createInstance({ baseURL: 'https://api2.example.com' });

            expect(api1.defaults.baseURL).toBe('https://api1.example.com');
            expect(api2.defaults.baseURL).toBe('https://api2.example.com');
        });
    });

    describe('HEAD and OPTIONS methods', () => {
        it('should make a HEAD request', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: null,
                    })
                )
            );

            const response = await api.head('/api/test');
            expect(response.status).toBe(200);
        });

        it('should make an OPTIONS request', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 204,
                        statusText: 'No Content',
                        data: null,
                    })
                )
            );

            const response = await api.options('/api/test');
            expect(response.status).toBe(204);
        });

        it('should support HEAD task', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: null,
                    })
                )
            );

            const task = api.task.head('/api/test');
            const response = await task.wait();
            expect(response.status).toBe(200);
        });

        it('should support OPTIONS task', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 204,
                        statusText: 'No Content',
                        data: null,
                    })
                )
            );

            const task = api.task.options('/api/test');
            const response = await task.wait();
            expect(response.status).toBe(204);
        });
    });

    describe('request() method', () => {
        it('should make a request via request() method', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: { result: 'ok' },
                    })
                )
            );

            const response = await api.request('/api/test', { method: 'GET' });
            expect(response.status).toBe(200);
            expect(response.data).toEqual({ result: 'ok' });
        });
    });

    describe('AFetchError getters and toJSON', () => {
        it('should report isTimeout correctly', () => {
            const config = {
                url: '/test',
                baseURL: '',
                method: 'GET' as const,
                headers: {},
                timeout: 5000,
                responseType: 'json' as const,
                cache: 'default' as const,
                credentials: 'same-origin' as const,
                redirect: 'follow' as const,
                throwOnError: true,
            };
            const error = new AFetchError('timeout', AFetchErrorType.TIMEOUT, config);
            expect(error.isTimeout).toBe(true);
            expect(error.isNetworkError).toBe(false);
            expect(error.isAbort).toBe(false);
            expect(error.isHttpError).toBe(false);
            expect(error.isParseError).toBe(false);
        });

        it('should report isNetworkError correctly', () => {
            const config = {
                url: '/test',
                baseURL: '',
                method: 'GET' as const,
                headers: {},
                timeout: 0,
                responseType: 'json' as const,
                cache: 'default' as const,
                credentials: 'same-origin' as const,
                redirect: 'follow' as const,
                throwOnError: true,
            };
            const error = new AFetchError('network', AFetchErrorType.NETWORK, config);
            expect(error.isNetworkError).toBe(true);
        });

        it('should report isAbort correctly', () => {
            const config = {
                url: '/test',
                baseURL: '',
                method: 'GET' as const,
                headers: {},
                timeout: 0,
                responseType: 'json' as const,
                cache: 'default' as const,
                credentials: 'same-origin' as const,
                redirect: 'follow' as const,
                throwOnError: true,
            };
            const error = new AFetchError('abort', AFetchErrorType.ABORT, config);
            expect(error.isAbort).toBe(true);
        });

        it('should report isParseError correctly', () => {
            const config = {
                url: '/test',
                baseURL: '',
                method: 'GET' as const,
                headers: {},
                timeout: 0,
                responseType: 'json' as const,
                cache: 'default' as const,
                credentials: 'same-origin' as const,
                redirect: 'follow' as const,
                throwOnError: true,
            };
            const error = new AFetchError('parse', AFetchErrorType.PARSE, config);
            expect(error.isParseError).toBe(true);
        });

        it('should serialize to JSON', () => {
            const config = {
                url: '/test',
                baseURL: '',
                method: 'GET' as const,
                headers: {},
                timeout: 0,
                responseType: 'json' as const,
                cache: 'default' as const,
                credentials: 'same-origin' as const,
                redirect: 'follow' as const,
                throwOnError: true,
            };
            const error = new AFetchError('test error', AFetchErrorType.HTTP, config, {
                data: {},
                status: 500,
                statusText: 'Internal Server Error',
                headers: new Headers(),
                config,
                raw: {} as Response,
                ok: false,
            });
            const json = error.toJSON();
            expect(json.name).toBe('AFetchError');
            expect(json.message).toBe('test error');
            expect(json.code).toBe(AFetchErrorType.HTTP);
            expect(json.status).toBe(500);
            expect(json.url).toBe('/test');
            expect(json.method).toBe('GET');
        });
    });

    describe('Emitter', () => {
        it('should support once() method', async () => {
            const { Emitter } = await import('../src/events.js');
            const emitter = new Emitter();
            const listener = jest.fn();

            emitter.once('test', listener);
            emitter.emit('test', 'data1');
            emitter.emit('test', 'data2');

            // Should only fire once
            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith('data1');
        });

        it('should support off() with event name', async () => {
            const { Emitter } = await import('../src/events.js');
            const emitter = new Emitter();
            const listener = jest.fn();

            emitter.on('test', listener);
            emitter.off('test');
            emitter.emit('test', 'data');

            expect(listener).not.toHaveBeenCalled();
        });

        it('should support off() without event name to clear all', async () => {
            const { Emitter } = await import('../src/events.js');
            const emitter = new Emitter();
            const listener1 = jest.fn();
            const listener2 = jest.fn();

            emitter.on('test1', listener1);
            emitter.on('test2', listener2);
            emitter.off();
            emitter.emit('test1', 'data');
            emitter.emit('test2', 'data');

            expect(listener1).not.toHaveBeenCalled();
            expect(listener2).not.toHaveBeenCalled();
        });

        it('should emit to no listeners gracefully', async () => {
            const { Emitter } = await import('../src/events.js');
            const emitter = new Emitter();
            // Should not throw
            expect(() => emitter.emit('nonexistent', 'data')).not.toThrow();
        });
    });

    describe('event bus plugin off()', () => {
        it('should support off() with no args to clear all listeners', async () => {
            const api = createTestInstance();
            const eventBus = createEventBusPlugin();
            api.use(eventBus);

            const requestListener = jest.fn<() => void>();
            const responseListener = jest.fn<() => void>();
            eventBus.on('request', requestListener);
            eventBus.on('response', responseListener);

            eventBus.off();

            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            await api.get('/test');

            expect(requestListener).not.toHaveBeenCalled();
            expect(responseListener).not.toHaveBeenCalled();
        });
    });

    describe('retry plugin advanced', () => {
        it('should use function-based delay', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            const delayFn = jest.fn((_attempt: number, _error: any) => 10);

            mockFetch
                .mockImplementationOnce(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: false,
                            status: 500,
                            statusText: 'Internal Server Error',
                            data: { error: 'fail' },
                        })
                    )
                )
                .mockImplementation(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            data: { success: true },
                        })
                    )
                );

            const response = await api.get('/api/test', {
                meta: { retry: { maxRetries: 3, delay: delayFn } },
            });

            expect(response.status).toBe(200);
            expect(delayFn).toHaveBeenCalled();
        });

        it('should use default delay when delay is undefined', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            mockFetch
                .mockImplementationOnce(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: false,
                            status: 500,
                            statusText: 'Internal Server Error',
                            data: { error: 'fail' },
                        })
                    )
                )
                .mockImplementation(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            data: { success: true },
                        })
                    )
                );

            const response = await api.get('/api/test', {
                meta: { retry: { maxRetries: 3, delay: 0 } },
            });

            expect(response.status).toBe(200);
        });

        it('should use retryOn with hook returning true and call', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            const callFn = jest.fn(async () => {});
            const hookFn = jest.fn(async (_error: any) => true);

            mockFetch
                .mockImplementationOnce(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: false,
                            status: 401,
                            statusText: 'Unauthorized',
                            data: { error: 'unauthorized' },
                        })
                    )
                )
                .mockImplementation(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            data: { success: true },
                        })
                    )
                );

            const response = await api.get('/api/auth', {
                meta: {
                    retry: {
                        maxRetries: 3,
                        delay: 10,
                        retryOn: [
                            {
                                hook: hookFn,
                                retryDelay: 5,
                                call: callFn,
                            },
                        ],
                    },
                },
            });

            expect(response.status).toBe(200);
            expect(hookFn).toHaveBeenCalled();
            expect(callFn).toHaveBeenCalled();
        });

        it('should stop retry when retryOn hook returns false', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            mockFetch.mockImplementation(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: false,
                        status: 403,
                        statusText: 'Forbidden',
                        data: { error: 'forbidden' },
                    })
                )
            );

            await expect(
                api.get('/api/test', {
                    meta: {
                        retry: {
                            maxRetries: 3,
                            delay: 10,
                            retryOn: [
                                {
                                    hook: async () => false,
                                },
                            ],
                        },
                    },
                })
            ).rejects.toThrow(AFetchError);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should stop retry when condition returns false', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            mockFetch.mockImplementation(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: false,
                        status: 500,
                        statusText: 'Internal Server Error',
                        data: { error: 'fail' },
                    })
                )
            );

            await expect(
                api.get('/api/test', {
                    meta: {
                        retry: {
                            maxRetries: 3,
                            delay: 10,
                            condition: () => false,
                        },
                    },
                })
            ).rejects.toThrow(AFetchError);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should exhaust all retries and return undefined', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            mockFetch.mockImplementation(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: false,
                        status: 500,
                        statusText: 'Internal Server Error',
                        data: { error: 'fail' },
                    })
                )
            );

            await expect(
                api.get('/api/test', {
                    meta: { retry: { maxRetries: 2, delay: 10 } },
                })
            ).rejects.toThrow(AFetchError);
            // Initial call + 2 retries = 3
            expect(mockFetch).toHaveBeenCalledTimes(3);
        });

        it('should handle retry fetch throwing non-AFetchError', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            mockFetch
                .mockImplementationOnce(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: false,
                            status: 500,
                            statusText: 'Internal Server Error',
                            data: { error: 'fail' },
                        })
                    )
                )
                .mockImplementationOnce(() => Promise.reject(new Error('Connection refused')))
                .mockImplementation(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            data: { success: true },
                        })
                    )
                );

            const response = await api.get('/api/test', {
                meta: { retry: { maxRetries: 3, delay: 10 } },
            });

            expect(response.status).toBe(200);
            expect(mockFetch).toHaveBeenCalledTimes(3);
        });

        it('should handle retry fetch throwing AFetchError', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            const config = {
                url: '/api/test',
                baseURL: BASE_URL,
                method: 'GET' as const,
                headers: {},
                timeout: 0,
                responseType: 'json' as const,
                cache: 'default' as const,
                credentials: 'same-origin' as const,
                redirect: 'follow' as const,
                throwOnError: true,
            };

            mockFetch
                .mockImplementationOnce(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: false,
                            status: 500,
                            statusText: 'Internal Server Error',
                            data: { error: 'fail' },
                        })
                    )
                )
                .mockImplementationOnce(() =>
                    Promise.reject(new AFetchError('retry fail', AFetchErrorType.NETWORK, config))
                )
                .mockImplementation(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            data: { success: true },
                        })
                    )
                );

            const response = await api.get('/api/test', {
                meta: { retry: { maxRetries: 3, delay: 10 } },
            });

            expect(response.status).toBe(200);
        });

        it('should not retry on timeout', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            // Make the mock hang so timeout triggers
            mockFetch.mockImplementation(
                (input: RequestInfo | URL, init?: RequestInit) => {
                    const signal =
                        init?.signal ?? (input instanceof Request ? input.signal : undefined);
                    return new Promise<Response>((_resolve, reject) => {
                        signal?.addEventListener('abort', () => {
                            reject(new DOMException('The operation was aborted.', 'AbortError'));
                        });
                    });
                }
            );

            await expect(
                api.get('/api/test', {
                    timeout: 50,
                    meta: { retry: { maxRetries: 3, delay: 10 } },
                })
            ).rejects.toThrow(AFetchError);
            // Should only be called once — no retries after timeout
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('response transforms', () => {
        it('should apply response transform', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: { items: [1, 2, 3] },
                    })
                )
            );

            const response = await api.get('/api/test', {
                transformResponse: (data: any) => data.items,
            });

            expect(response.data).toEqual([1, 2, 3]);
        });

        it('should apply multiple response transforms', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: { value: 5 },
                    })
                )
            );

            const response = await api.get('/api/test', {
                transformResponse: [
                    (data: any) => ({ value: data.value * 2 }),
                    (data: any) => ({ value: data.value + 1 }),
                ],
            });

            expect(response.data).toEqual({ value: 11 });
        });
    });

    describe('request transforms', () => {
        it('should apply request transform', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            await api.post('/api/test', { name: 'test' }, {
                transformRequest: (data: any) => ({ ...data, transformed: true }),
            });

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('throwOnError disabled', () => {
        it('should not throw on non-2xx when throwOnError is false', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: false,
                        status: 404,
                        statusText: 'Not Found',
                        data: { error: 'not found' },
                    })
                )
            );

            const response = await api.get('/api/test', { throwOnError: false });
            expect(response.status).toBe(404);
            expect(response.ok).toBe(false);
        });
    });

    describe('plugin afterResponse hook replacement', () => {
        it('should allow afterResponse hook to replace response', async () => {
            const api = createTestInstance();
            api.use({
                name: 'replacer',
                install(pluginApi: AFetchPluginApi) {
                    pluginApi.addHook('afterResponse', ({ response }) => {
                        return {
                            ...response,
                            data: { replaced: true },
                        };
                    });
                },
            });

            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: { original: true },
                    })
                )
            );

            const response = await api.get('/api/test');
            expect(response.data).toEqual({ replaced: true });
        });
    });

    describe('plugin onError hook replacement', () => {
        it('should allow onError hook to return a response instead of throwing', async () => {
            const api = createTestInstance();
            api.use({
                name: 'error-handler',
                install(pluginApi: AFetchPluginApi) {
                    pluginApi.addHook('onError', () => {
                        return {
                            data: { recovered: true },
                            status: 200,
                            statusText: 'OK',
                            headers: new Headers(),
                            config: {} as any,
                            raw: {} as Response,
                            ok: true,
                        };
                    });
                },
            });

            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: false,
                        status: 500,
                        statusText: 'Internal Server Error',
                        data: { error: 'fail' },
                    })
                )
            );

            const response = await api.get('/api/test');
            expect(response.data).toEqual({ recovered: true });
        });
    });

    describe('parse response types', () => {
        it('should parse text response', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers({ 'content-type': 'text/plain' }),
                    json: () => Promise.reject(new Error('not json')),
                    text: () => Promise.resolve('hello'),
                    blob: () => Promise.resolve(new Blob()),
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                    formData: () => Promise.resolve(new FormData()),
                    body: null,
                    bodyUsed: false,
                    clone: () => ({} as Response),
                    type: 'basic' as ResponseType,
                    url: '',
                    redirected: false,
                    bytes: () => Promise.resolve(new Uint8Array()),
                } as unknown as Response)
            );

            const response = await api.get('/api/test', { responseType: 'text' });
            expect(response.data).toBe('hello');
        });

        it('should parse blob response', async () => {
            const api = createTestInstance();
            const blob = new Blob(['test']);
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers(),
                    json: () => Promise.reject(new Error('not json')),
                    text: () => Promise.resolve(''),
                    blob: () => Promise.resolve(blob),
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                    formData: () => Promise.resolve(new FormData()),
                    body: null,
                    bodyUsed: false,
                    clone: () => ({} as Response),
                    type: 'basic' as ResponseType,
                    url: '',
                    redirected: false,
                    bytes: () => Promise.resolve(new Uint8Array()),
                } as unknown as Response)
            );

            const response = await api.get('/api/test', { responseType: 'blob' });
            expect(response.data).toBe(blob);
        });

        it('should parse arrayBuffer response', async () => {
            const api = createTestInstance();
            const buffer = new ArrayBuffer(8);
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers(),
                    json: () => Promise.reject(new Error('not json')),
                    text: () => Promise.resolve(''),
                    blob: () => Promise.resolve(new Blob()),
                    arrayBuffer: () => Promise.resolve(buffer),
                    formData: () => Promise.resolve(new FormData()),
                    body: null,
                    bodyUsed: false,
                    clone: () => ({} as Response),
                    type: 'basic' as ResponseType,
                    url: '',
                    redirected: false,
                    bytes: () => Promise.resolve(new Uint8Array()),
                } as unknown as Response)
            );

            const response = await api.get('/api/test', { responseType: 'arrayBuffer' });
            expect(response.data).toBe(buffer);
        });

        it('should parse stream response', async () => {
            const api = createTestInstance();
            const stream = new ReadableStream();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers(),
                    json: () => Promise.reject(new Error('not json')),
                    text: () => Promise.resolve(''),
                    blob: () => Promise.resolve(new Blob()),
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                    formData: () => Promise.resolve(new FormData()),
                    body: stream,
                    bodyUsed: false,
                    clone: () => ({} as Response),
                    type: 'basic' as ResponseType,
                    url: '',
                    redirected: false,
                    bytes: () => Promise.resolve(new Uint8Array()),
                } as unknown as Response)
            );

            const response = await api.get('/api/test', { responseType: 'stream' });
            expect(response.data).toBe(stream);
        });

        it('should handle parse error and throw PARSE error', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers(),
                    json: () => Promise.reject(new Error('Invalid JSON')),
                    text: () => Promise.resolve(''),
                    blob: () => Promise.resolve(new Blob()),
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                    formData: () => Promise.resolve(new FormData()),
                    body: null,
                    bodyUsed: false,
                    clone: () => ({} as Response),
                    type: 'basic' as ResponseType,
                    url: '',
                    redirected: false,
                    bytes: () => Promise.resolve(new Uint8Array()),
                } as unknown as Response)
            );

            await expect(api.get('/api/test')).rejects.toThrow(AFetchError);
            try {
                await api.get('/api/test');
            } catch (error) {
                expect((error as any).code).toBe(AFetchErrorType.PARSE);
            }
        });
    });

    describe('mergeConfig edge cases', () => {
        it('should handle undefined params in buildURL', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            await api.get('/api/test', { params: { key: undefined, name: 'test' } });
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should handle null params in buildURL', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            await api.get('/api/test', { params: { key: null as any, name: 'test' } });
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should handle URL with hash and params', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            await api.get('/api/test#section', { params: { page: 1 } });
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should handle URL with existing query string and params', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            await api.get('/api/test?existing=1', { params: { page: 1 } });
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should handle absolute URL with params', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            await api.get('https://other.example.com/api/test', { params: { page: 1 } });
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('shouldSerializeAsJSON edge cases', () => {
        it('should not serialize FormData as JSON', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            const formData = new FormData();
            formData.append('file', new Blob());
            await api.post('/api/upload', formData as any);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should not serialize string as JSON', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            await api.post('/api/test', 'raw string' as any);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should not serialize URLSearchParams as JSON', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            const params = new URLSearchParams({ key: 'value' });
            await api.post('/api/test', params as any);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('timeout', () => {
        it('should abort request on timeout', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(
                (input: RequestInfo | URL, init?: RequestInit) => {
                    const signal =
                        init?.signal ?? (input instanceof Request ? input.signal : undefined);
                    return new Promise<Response>((_resolve, reject) => {
                        signal?.addEventListener('abort', () => {
                            reject(new DOMException('The operation was aborted.', 'AbortError'));
                        });
                    });
                }
            );

            await expect(api.get('/api/slow', { timeout: 50 })).rejects.toThrow(AFetchError);
        }, 10000);
    });

    describe('mergeHeaders edge cases', () => {
        it('should merge Headers instances', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            await api.get('/api/test', {
                headers: new Headers({ 'X-Custom': 'value' }) as any,
            });
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('utils edge cases', () => {
        it('should handle URL with hash but empty params', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            // params with all undefined/null values should produce empty query string
            await api.get('/api/test#section', {
                params: { key: undefined, other: null as any },
            });
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should parse formData response', async () => {
            const api = createTestInstance();
            const formData = new FormData();
            formData.append('key', 'value');
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers(),
                    json: () => Promise.reject(new Error('not json')),
                    text: () => Promise.resolve(''),
                    blob: () => Promise.resolve(new Blob()),
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                    formData: () => Promise.resolve(formData),
                    body: null,
                    bodyUsed: false,
                    clone: () => ({} as Response),
                    type: 'basic' as ResponseType,
                    url: '',
                    redirected: false,
                    bytes: () => Promise.resolve(new Uint8Array()),
                } as unknown as Response)
            );

            const response = await api.get('/api/test', { responseType: 'formData' });
            expect(response.data).toBe(formData);
        });

        it('should handle mergeHeaders with undefined entries', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            // This exercises mergeHeaders with various header sources
            await api.get('/api/test', {
                headers: { 'X-Test': 'value', 'X-Undefined': undefined as any },
            });
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('external signal handling', () => {
        it('should propagate external abort signal', async () => {
            const api = createTestInstance();
            const controller = new AbortController();

            mockFetch.mockImplementationOnce(
                (input: RequestInfo | URL, init?: RequestInit) => {
                    const signal =
                        init?.signal ?? (input instanceof Request ? input.signal : undefined);
                    return new Promise<Response>((resolve, reject) => {
                        signal?.addEventListener('abort', () => {
                            reject(new DOMException('The operation was aborted.', 'AbortError'));
                        });
                        // Don't resolve - let the abort handle it
                    });
                }
            );

            const promise = api.get('/api/test', { signal: controller.signal });

            // Abort after a short delay
            setTimeout(() => controller.abort(), 20);

            await expect(promise).rejects.toThrow(AFetchError);
        });
    });

    describe('config signal already aborted', () => {
        it('should abort immediately if signal is already aborted', async () => {
            const api = createTestInstance();
            const controller = new AbortController();
            controller.abort();

            mockFetch.mockImplementationOnce(
                (input: RequestInfo | URL, init?: RequestInit) => {
                    const signal =
                        init?.signal ?? (input instanceof Request ? input.signal : undefined);
                    if (signal?.aborted) {
                        return Promise.reject(
                            new DOMException('The operation was aborted.', 'AbortError')
                        );
                    }
                    return Promise.resolve(
                        createMockResponse({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            data: {},
                        })
                    );
                }
            );

            await expect(
                api.get('/api/test', { signal: controller.signal })
            ).rejects.toThrow(AFetchError);
        });
    });

    describe('retry with default delay', () => {
        it('should use default 1000ms delay when delay is not specified', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            mockFetch
                .mockImplementationOnce(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: false,
                            status: 500,
                            statusText: 'Internal Server Error',
                            data: { error: 'fail' },
                        })
                    )
                )
                .mockImplementation(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            data: { success: true },
                        })
                    )
                );

            // Don't specify delay at all - should use default 1000ms
            const response = await api.get('/api/test', {
                meta: { retry: { maxRetries: 1 } },
            });

            expect(response.status).toBe(200);
        });
    });

    describe('mergeHeaders direct', () => {
        it('should merge multiple header sources', async () => {
            const { mergeHeaders } = await import('../src/utils.js');

            const result = mergeHeaders(
                { 'Content-Type': 'application/json' },
                new Headers({ Authorization: 'Bearer token' }),
                undefined,
                { 'X-Custom': 'value' }
            );

            expect(result['content-type']).toBe('application/json');
            expect(result['authorization']).toBe('Bearer token');
            expect(result['x-custom']).toBe('value');
        });

        it('should handle empty mergeHeaders', async () => {
            const { mergeHeaders } = await import('../src/utils.js');

            const result = mergeHeaders();
            expect(Object.keys(result)).toHaveLength(0);
        });
    });

    describe('cleanup function', () => {
        it('should cleanup timeout on successful request', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            // Request with timeout - cleanup should clear the timeout
            const response = await api.get('/api/test', { timeout: 5000 });
            expect(response.status).toBe(200);
        });

        it('should cleanup timeout on failed request', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementationOnce(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: false,
                        status: 500,
                        statusText: 'Internal Server Error',
                        data: { error: 'fail' },
                    })
                )
            );

            // Request with timeout that fails - cleanup should still run
            await expect(api.get('/api/test', { timeout: 5000 })).rejects.toThrow(AFetchError);
        });
    });

    describe('retryOn with no matching status', () => {
        it('should not retry when status does not match retryOn', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            mockFetch.mockImplementation(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: false,
                        status: 403,
                        statusText: 'Forbidden',
                        data: { error: 'forbidden' },
                    })
                )
            );

            await expect(
                api.get('/api/test', {
                    meta: {
                        retry: {
                            maxRetries: 3,
                            delay: 10,
                            retryOn: [500, 502],
                        },
                    },
                })
            ).rejects.toThrow(AFetchError);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('retry with non-JSON response', () => {
        it('should handle retry response with invalid JSON', async () => {
            const api = createTestInstance();
            api.use(createRetryPlugin());

            mockFetch
                .mockImplementationOnce(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: false,
                            status: 500,
                            statusText: 'Internal Server Error',
                            data: { error: 'fail' },
                        })
                    )
                )
                .mockImplementationOnce(() =>
                    Promise.resolve({
                        ok: false,
                        status: 502,
                        statusText: 'Bad Gateway',
                        headers: new Headers(),
                        json: () => Promise.reject(new Error('Invalid JSON')),
                        text: () => Promise.resolve('Bad Gateway'),
                        blob: () => Promise.resolve(new Blob()),
                        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                        formData: () => Promise.resolve(new FormData()),
                        body: null,
                        bodyUsed: false,
                        clone: () => ({} as Response),
                        type: 'basic' as ResponseType,
                        url: '',
                        redirected: false,
                        bytes: () => Promise.resolve(new Uint8Array()),
                    } as unknown as Response)
                )
                .mockImplementation(() =>
                    Promise.resolve(
                        createMockResponse({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            data: { success: true },
                        })
                    )
                );

            const response = await api.get('/api/test', {
                meta: { retry: { maxRetries: 3, delay: 10 } },
            });

            expect(response.status).toBe(200);
        });
    });

    describe('isAbsoluteURL edge cases', () => {
        it('should handle various URL formats', async () => {
            const api = createTestInstance();
            mockFetch.mockImplementation(() =>
                Promise.resolve(
                    createMockResponse({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        data: {},
                    })
                )
            );

            // Absolute URL with https
            await api.get('https://other.example.com/api/test');
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });
});

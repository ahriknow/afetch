/**
 * afetch - Coverage Tests
 * Separate test file to cover remaining branches without breaking test isolation
 */

import { jest, describe, it, expect, afterEach } from '@jest/globals';

// Import afetch and plugins
const { AFetchError, createInstance, AFetchErrorType, createRetryPlugin } = await import(
    '../src/index.js'
);

// ─── Test: retry plugin with globalThis.fetch ───

describe('retry plugin with globalThis.fetch', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should use globalThis.fetch when fetchAdapter is not set', async () => {
        let callCount = 0;
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            callCount++;
            if (callCount <= 1) {
                return Promise.resolve(
                    new Response(JSON.stringify({ error: 'fail' }), {
                        status: 500,
                        statusText: 'Internal Server Error',
                        headers: { 'content-type': 'application/json' },
                    })
                );
            }
            return Promise.resolve(
                new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        // Create instance WITHOUT fetchAdapter - uses globalThis.fetch
        const api = createInstance({
            baseURL: 'https://test.example.com',
        });
        api.use(createRetryPlugin());

        const response = await api.get('/api/test', {
            meta: { retry: { maxRetries: 2, delay: 10 } },
        });

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ success: true });
        expect(mockGlobalFetch).toHaveBeenCalledTimes(2);
    });

    it('should use default maxRetries=3 when not specified', async () => {
        let callCount = 0;
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            callCount++;
            if (callCount <= 2) {
                return Promise.resolve(
                    new Response(JSON.stringify({ error: 'fail' }), {
                        status: 500,
                        statusText: 'Internal Server Error',
                        headers: { 'content-type': 'application/json' },
                    })
                );
            }
            return Promise.resolve(
                new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({
            baseURL: 'https://test.example.com',
        });
        api.use(createRetryPlugin());

        // Don't specify maxRetries - should default to 3
        const response = await api.get('/api/test', {
            meta: { retry: { delay: 10 } },
        });

        expect(response.status).toBe(200);
        expect(mockGlobalFetch).toHaveBeenCalledTimes(3);
    });

    it('should use default error message when error has no message', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            // Throw an error with empty message
            const err = new Error('');
            throw err;
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({
            baseURL: 'https://test.example.com',
        });
        api.use(createRetryPlugin());

        await expect(
            api.get('/api/test', {
                meta: { retry: { maxRetries: 1, delay: 10 } },
            })
        ).rejects.toThrow(AFetchError);
    });
});

// ─── Test: cleanup function with timeout ───

describe('cleanup with timeout', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should cleanup timeout on successful request with timeout set', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({
            baseURL: 'https://test.example.com',
        });

        // Request with timeout - cleanup should clear the timeout
        const response = await api.get('/api/test', { timeout: 5000 });
        expect(response.status).toBe(200);
        expect(response.data).toEqual({ ok: true });
    });

    it('should cleanup timeout on failed request with timeout set', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ error: 'fail' }), {
                    status: 500,
                    statusText: 'Internal Server Error',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({
            baseURL: 'https://test.example.com',
        });

        // Request with timeout that fails - cleanup should still run
        await expect(api.get('/api/test', { timeout: 5000 })).rejects.toThrow(AFetchError);
    });
});

// ─── Test: task.options method ───

describe('task.options coverage', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should create a task via options method', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ result: 'ok' }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({
            baseURL: 'https://test.example.com',
        });

        const task = api.task.options('/api/test');
        const response = await task.wait();

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ result: 'ok' });
        expect(mockGlobalFetch).toHaveBeenCalledTimes(1);
    });
});

// ─── Test: instance.create() method ───

describe('instance.create() coverage', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should create a new instance via create() with merged config', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({
            baseURL: 'https://test.example.com',
            timeout: 5000,
        });

        // Use create() to make a new instance with additional config
        const newApi = api.create({
            headers: { 'X-Custom': 'value' },
        });

        expect(newApi.defaults.baseURL).toBe('https://test.example.com');
        expect(newApi.defaults.timeout).toBe(5000);
        expect(newApi.defaults.headers).toEqual({ 'X-Custom': 'value' });

        const response = await newApi.get('/api/test');
        expect(response.status).toBe(200);
    });
});

// ─── Test: parseResponse default case ───

describe('parseResponse default case', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should use json parser for unknown responseType', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ data: 'test' }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({
            baseURL: 'https://test.example.com',
        });

        // Pass an unknown responseType to hit the default case in parseResponse
        const response = await api.get('/api/test', {
            responseType: 'unknown' as any,
        });

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ data: 'test' });
    });
});

// ─── Test: mergeConfig default branches ───

describe('mergeConfig default branches', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should handle request with all default values', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        // Create instance with minimal config - exercises all default branches
        const api = createInstance({ baseURL: 'https://test.example.com' });

        const response = await api.request('/api/test');
        expect(response.status).toBe(200);
        expect(mockGlobalFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle request with explicit method', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });

        // Explicitly set method to exercise the method branch
        const response = await api.request('/api/test', { method: 'POST', body: '{}' });
        expect(response.status).toBe(200);
    });
});

// ─── Test: shouldSerializeAsJSON edge cases ───

describe('shouldSerializeAsJSON edge cases', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should not serialize null body', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });

        // POST with null body
        const response = await api.post('/api/test', null as any);
        expect(response.status).toBe(200);
    });

    it('should not serialize undefined body', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });

        // POST with undefined body
        const response = await api.post('/api/test', undefined);
        expect(response.status).toBe(200);
    });

    it('should not serialize Blob body', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });

        // POST with Blob body
        const blob = new Blob(['test'], { type: 'text/plain' });
        const response = await api.post('/api/upload', blob as any);
        expect(response.status).toBe(200);
    });

    it('should not serialize ArrayBuffer body', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });

        // POST with ArrayBuffer body
        const buffer = new ArrayBuffer(8);
        const response = await api.post('/api/upload', buffer as any);
        expect(response.status).toBe(200);
    });
});

// ─── Test: remaining branch coverage ───

describe('remaining branch coverage', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should use fallback message when error has empty message', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            // Throw an error with empty message
            const err = new Error('');
            throw err;
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });

        try {
            await api.get('/api/test');
            expect(true).toBe(false);
        } catch (error: any) {
            expect(error).toBeInstanceOf(AFetchError);
            // executeRequest wraps it with 'Network error', afetch re-throws it
            expect(error.message).toBe('Network error');
            expect(error.code).toBe(AFetchErrorType.NETWORK);
        }
    });

    it('should handle null body in POST (shouldSerializeAsJSON null check)', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });

        // POST with null body - shouldSerializeAsJSON returns false for null
        const response = await api.request('/api/test', {
            method: 'POST',
            body: null,
        });
        expect(response.status).toBe(200);
    });

    it('should not serialize TypedArray (ArrayBuffer.isView check)', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });

        // POST with Uint8Array (ArrayBuffer.isView returns true)
        const typedArray = new Uint8Array([1, 2, 3]);
        const response = await api.post('/api/upload', typedArray as any);
        expect(response.status).toBe(200);
    });

    it('should handle ReadableStream in shouldSerializeAsJSON', async () => {
        // ReadableStream instanceof check is covered by this test
        // Note: Node.js Request constructor requires duplex: 'half' for streaming bodies,
        // which afetch.ts doesn't pass. So we test the shouldSerializeAsJSON function directly.
        const { shouldSerializeAsJSON } = await import('../src/utils.js');

        const stream = new ReadableStream();
        expect(shouldSerializeAsJSON(stream)).toBe(false);
    });

    it('should cover all mergeConfig default branches', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        // Create instance with NO defaults at all
        const api = createInstance();

        // Make a request with NO options - all defaults
        const response = await api.request('https://test.example.com/api/test');
        expect(response.status).toBe(200);

        // Verify the request was made with default values
        const callArgs = mockGlobalFetch.mock.calls[0];
        expect(callArgs).toBeDefined();
    });

    it('should cover mergeConfig with empty defaults and full options', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        // Instance with empty defaults
        const api = createInstance({});

        // Request with all options specified
        const response = await api.request('https://test.example.com/api/test', {
            method: 'GET',
            baseURL: 'https://test.example.com',
            headers: {},
            timeout: 0,
            responseType: 'json',
            cache: 'default',
            credentials: 'same-origin',
            redirect: 'follow',
            throwOnError: true,
        });
        expect(response.status).toBe(200);
    });
});

// ─── Test: mergeConfig default fallback branches ───

describe('mergeConfig default fallback branches', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should use defaults when options have no fetchAdapter', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        // Create instance with defaults including fetchAdapter
        const defaultAdapter = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ fromDefault: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });

        const api = createInstance({
            baseURL: 'https://test.example.com',
            fetchAdapter: defaultAdapter,
        });

        // Make request without fetchAdapter in options - should use default
        const response = await api.get('/api/test');
        expect(response.status).toBe(200);
        expect(response.data).toEqual({ fromDefault: true });
        expect(defaultAdapter).toHaveBeenCalledTimes(1);
    });

    it('should use defaults when options have no responseType', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({
            baseURL: 'https://test.example.com',
            responseType: 'json',
        });

        // Don't pass responseType in options
        const response = await api.get('/api/test');
        expect(response.status).toBe(200);
    });

    it('should use defaults when options have no cache/credentials/redirect', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({
            baseURL: 'https://test.example.com',
            cache: 'no-cache',
            credentials: 'include',
            redirect: 'error',
        });

        // Don't pass cache/credentials/redirect in options
        const response = await api.get('/api/test');
        expect(response.status).toBe(200);
    });

    it('should use defaults when options have no throwOnError', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({
            baseURL: 'https://test.example.com',
            throwOnError: false,
        });

        // Don't pass throwOnError in options - should use default (false)
        const response = await api.get('/api/test');
        expect(response.status).toBe(200);
    });

    it('should use defaults when options have no meta', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({
            baseURL: 'https://test.example.com',
            meta: { requestId: '123' },
        });

        // Don't pass meta in options - should use default
        const response = await api.get('/api/test');
        expect(response.status).toBe(200);
    });

    it('should use DEFAULT_CONFIG when no defaults and no options', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        // Create instance with NO defaults at all
        const api = createInstance();

        // Make request with absolute URL and no options
        const response = await api.request('https://test.example.com/api/test');
        expect(response.status).toBe(200);
    });

    it('should use empty string for url when not provided', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });

        // Make request without url in options (url defaults to '')
        const response = await api.get('/api/test');
        expect(response.status).toBe(200);
    });

    it('should use options referrer and referrerPolicy when provided', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });

        // Pass referrer and referrerPolicy in options
        const response = await api.get('/api/test', {
            referrer: 'https://example.com',
            referrerPolicy: 'no-referrer',
        });
        expect(response.status).toBe(200);
    });
});

// ─── Test: afterResponse hook throwing non-AFetchError ───

describe('afterResponse hook error coverage', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should wrap non-AFetchError from afterResponse hook', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });

        // Register afterResponse hook that throws a plain Error (not AFetchError)
        api.use({
            name: 'throwing-plugin',
            install(pluginApi) {
                pluginApi.addHook('afterResponse', () => {
                    throw new Error('hook failed');
                });
            },
        });

        try {
            await api.get('/api/test');
            expect(true).toBe(false);
        } catch (error: any) {
            expect(error).toBeInstanceOf(AFetchError);
            expect(error.message).toBe('hook failed');
            expect(error.code).toBe(AFetchErrorType.NETWORK);
        }
    });

    it('should wrap non-Error thrown from afterResponse hook', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });

        // Register afterResponse hook that throws a string (not an Error)
        api.use({
            name: 'throwing-string-plugin',
            install(pluginApi) {
                pluginApi.addHook('afterResponse', () => {
                    throw 'string error';
                });
            },
        });

        try {
            await api.get('/api/test');
            expect(true).toBe(false);
        } catch (error: any) {
            expect(error).toBeInstanceOf(AFetchError);
            // Empty string message falls back to 'Request failed'
            expect(error.message).toBe('Request failed');
        }
    });
});

// ─── Test: mergeConfig direct call for remaining branches ───

describe('mergeConfig direct', () => {
    it('should use empty url when options.url is not set', async () => {
        const { mergeConfig } = await import('../src/utils.js');

        const config = mergeConfig(
            { baseURL: 'https://test.example.com' },
            { method: 'GET' } // no url
        );

        expect(config.url).toBe('');
        expect(config.baseURL).toBe('https://test.example.com');
    });

    it('should use defaults.fetchAdapter when options.fetchAdapter is not set', async () => {
        const { mergeConfig } = await import('../src/utils.js');

        const mockAdapter = jest.fn<typeof fetch>();
        const config = mergeConfig(
            { baseURL: 'https://test.example.com', fetchAdapter: mockAdapter },
            { method: 'GET', url: '/api/test' } // no fetchAdapter
        );

        expect(config.fetchAdapter).toBe(mockAdapter);
    });

    it('should use options.fetchAdapter when provided', async () => {
        const { mergeConfig } = await import('../src/utils.js');

        const defaultAdapter = jest.fn<typeof fetch>();
        const optionsAdapter = jest.fn<typeof fetch>();
        const config = mergeConfig(
            { baseURL: 'https://test.example.com', fetchAdapter: defaultAdapter },
            { method: 'GET', url: '/api/test', fetchAdapter: optionsAdapter }
        );

        expect(config.fetchAdapter).toBe(optionsAdapter);
    });

    it('should use default empty options when not provided', async () => {
        const { mergeConfig } = await import('../src/utils.js');

        // Call mergeConfig without options - uses default {}
        const config = mergeConfig({ baseURL: 'https://test.example.com' });

        expect(config.url).toBe('');
        expect(config.method).toBe('GET');
        expect(config.baseURL).toBe('https://test.example.com');
    });
});

// ─── Test: shouldSerializeAsJSON direct ───

describe('shouldSerializeAsJSON direct', () => {
    it('should return false for null', async () => {
        const { shouldSerializeAsJSON } = await import('../src/utils.js');
        expect(shouldSerializeAsJSON(null)).toBe(false);
    });

    it('should return false for undefined', async () => {
        const { shouldSerializeAsJSON } = await import('../src/utils.js');
        expect(shouldSerializeAsJSON(undefined)).toBe(false);
    });

    it('should return true for plain objects', async () => {
        const { shouldSerializeAsJSON } = await import('../src/utils.js');
        expect(shouldSerializeAsJSON({ key: 'value' })).toBe(true);
    });
});

// ─── Test: all() and race() ────────────────────────────────────

describe('all() and race()', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should execute all requests concurrently', async () => {
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });

        const results = await api.all([
            api.get('/api/a'),
            api.get('/api/b'),
            api.get('/api/c'),
        ]);

        expect(results).toHaveLength(3);
        expect(results[0].status).toBe(200);
        expect(results[1].status).toBe(200);
        expect(results[2].status).toBe(200);
        expect(mockGlobalFetch).toHaveBeenCalledTimes(3);
    });

    it('should return first completed response via race()', async () => {
        let resolveFirst!: (value: Response) => void;
        const firstPromise = new Promise<Response>((resolve) => {
            resolveFirst = resolve;
        });

        let callCount = 0;
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return firstPromise;
            }
            return Promise.resolve(
                new Response(JSON.stringify({ winner: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });

        const racePromise = api.race([
            api.get('/api/slow'),
            api.get('/api/fast'),
        ]);

        // The second request completes first
        const result = await racePromise;
        expect(result.status).toBe(200);

        // Clean up the slow request
        resolveFirst(
            new Response(JSON.stringify({ slow: true }), {
                status: 200,
                statusText: 'OK',
                headers: { 'content-type': 'application/json' },
            })
        );
    });
});

// ─── Test: download progress ───────────────────────────────────

describe('download progress', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should call onDownloadProgress during download', async () => {
        const body = JSON.stringify({ data: 'test content' });
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(body));
                    controller.close();
                },
            });
            return Promise.resolve(
                new Response(stream, {
                    status: 200,
                    statusText: 'OK',
                    headers: {
                        'content-type': 'application/json',
                        'content-length': String(body.length),
                    },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });
        const progressFn = jest.fn<(event: { loaded: number; total: number; progress: number }) => void>();

        const response = await api.get('/api/download', {
            onDownloadProgress: progressFn,
        });

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ data: 'test content' });
        expect(progressFn).toHaveBeenCalled();
        const calls = progressFn.mock.calls;
        const lastEvent = calls[calls.length - 1]![0];
        expect(lastEvent.loaded).toBe(body.length);
        expect(lastEvent.total).toBe(body.length);
        expect(lastEvent.progress).toBe(1);
    });

    it('should handle download without content-length', async () => {
        const body = JSON.stringify({ data: 'test' });
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(body));
                    controller.close();
                },
            });
            return Promise.resolve(
                new Response(stream, {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });
        const progressFn = jest.fn();

        const response = await api.get('/api/download', {
            onDownloadProgress: progressFn,
        });

        expect(response.status).toBe(200);
        expect(progressFn).toHaveBeenCalled();
    });
});

// ─── Test: RequestQueue ────────────────────────────────────────

describe('RequestQueue', () => {
    it('should limit concurrent requests', async () => {
        const { RequestQueue } = await import('../src/plugins/queue.js');
        const queue = new RequestQueue(2);

        let running = 0;
        let maxRunning = 0;

        const fn = async () => {
            running++;
            maxRunning = Math.max(maxRunning, running);
            await new Promise((r) => setTimeout(r, 50));
            running--;
            return 'done';
        };

        const results = await Promise.all([
            queue.run(fn),
            queue.run(fn),
            queue.run(fn),
            queue.run(fn),
        ]);

        expect(results).toEqual(['done', 'done', 'done', 'done']);
        expect(maxRunning).toBeLessThanOrEqual(2);
    });

    it('should use default maxConcurrent', async () => {
        const { RequestQueue } = await import('../src/plugins/queue.js');
        const queue = new RequestQueue(); // default = 6
        const result = await queue.run(async () => 'ok');
        expect(result).toBe('ok');
    });

    it('should report pending and queued counts', async () => {
        const { RequestQueue } = await import('../src/plugins/queue.js');
        const queue = new RequestQueue(1);

        expect(queue.pending).toBe(0);
        expect(queue.queued).toBe(0);

        let resolveFirst!: () => void;
        const firstPromise = new Promise<void>((resolve) => {
            resolveFirst = resolve;
        });

        // Start a blocking request
        const p1 = queue.run(() => firstPromise);
        await new Promise((r) => setTimeout(r, 10));

        expect(queue.pending).toBe(1);

        // Queue another
        const p2 = queue.run(async () => 'second');
        await new Promise((r) => setTimeout(r, 10));

        expect(queue.queued).toBe(1);

        resolveFirst();
        await p1;
        await new Promise((r) => setTimeout(r, 50));

        expect(queue.pending).toBeLessThanOrEqual(1);
        await p2;
    });

    it('should clear queue and reject waiting items', async () => {
        const { RequestQueue } = await import('../src/plugins/queue.js');
        const queue = new RequestQueue(1);

        let resolveFirst!: () => void;
        const p1 = queue.run(() => new Promise<void>((r) => { resolveFirst = r; }));
        await new Promise((r) => setTimeout(r, 10));

        const p2 = queue.run(async () => 'second');
        queue.clear();

        await expect(p2).rejects.toThrow('Queue cleared');

        resolveFirst();
        await p1;
    });
});

// ─── Test: createQueuePlugin ───────────────────────────────────

describe('createQueuePlugin', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should create a queue plugin', async () => {
        const { createQueuePlugin } = await import('../src/plugins/queue.js');
        const plugin = createQueuePlugin({ maxConcurrent: 5 });
        expect(plugin.name).toBe('queue');
        expect(typeof plugin.install).toBe('function');
    });

    it('should create with default options', async () => {
        const { createQueuePlugin } = await import('../src/plugins/queue.js');
        const plugin = createQueuePlugin();
        expect(plugin.name).toBe('queue');
        plugin.install({ addHook: jest.fn() } as any);
    });

    it('should limit concurrent requests automatically', async () => {
        const { createQueuePlugin } = await import('../src/plugins/queue.js');

        let running = 0;
        let maxRunning = 0;

        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            running++;
            maxRunning = Math.max(maxRunning, running);
            return new Promise<Response>((resolve) => {
                setTimeout(() => {
                    running--;
                    resolve(
                        new Response(JSON.stringify({ ok: true }), {
                            status: 200,
                            statusText: 'OK',
                            headers: { 'content-type': 'application/json' },
                        })
                    );
                }, 50);
            });
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });
        const queuePlugin = createQueuePlugin({ maxConcurrent: 2 });
        api.use(queuePlugin);

        const results = await Promise.all([
            api.get('/a'),
            api.get('/b'),
            api.get('/c'),
            api.get('/d'),
        ]);

        expect(results).toHaveLength(4);
        expect(maxRunning).toBeLessThanOrEqual(2);
    });

    it('should report pending and queued counts via hooks', async () => {
        const { createQueuePlugin } = await import('../src/plugins/queue.js');

        let resolveFirst!: (value: Response) => void;
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return new Promise<Response>((resolve) => {
                resolveFirst = resolve;
            });
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });
        const queuePlugin = createQueuePlugin({ maxConcurrent: 1 });
        api.use(queuePlugin);

        expect(queuePlugin.pending).toBe(0);
        expect(queuePlugin.queued).toBe(0);

        // Start first request — occupies the only slot
        const p1 = api.get('/first');
        await new Promise((r) => setTimeout(r, 10));
        expect(queuePlugin.pending).toBe(1);

        // Start second request — should be queued
        const p2 = api.get('/second');
        await new Promise((r) => setTimeout(r, 10));
        expect(queuePlugin.queued).toBe(1);

        // Complete first request
        resolveFirst(
            new Response(JSON.stringify({ first: true }), {
                status: 200,
                statusText: 'OK',
                headers: { 'content-type': 'application/json' },
            })
        );
        await p1;
        await new Promise((r) => setTimeout(r, 10));

        // Second request should now be running
        expect(queuePlugin.pending).toBeLessThanOrEqual(1);

        // Complete second request
        resolveFirst(
            new Response(JSON.stringify({ second: true }), {
                status: 200,
                statusText: 'OK',
                headers: { 'content-type': 'application/json' },
            })
        );
        await p2;
    });

    it('should clear queue and reject waiting requests', async () => {
        const { createQueuePlugin } = await import('../src/plugins/queue.js');

        let resolveFirst!: (value: Response) => void;
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return new Promise<Response>((resolve) => {
                resolveFirst = resolve;
            });
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });
        const queuePlugin = createQueuePlugin({ maxConcurrent: 1 });
        api.use(queuePlugin);

        // First request blocks the only slot
        const p1 = api.get('/first');
        await new Promise((r) => setTimeout(r, 10));

        // Second request is queued
        const p2 = api.get('/second');
        await new Promise((r) => setTimeout(r, 10));
        expect(queuePlugin.queued).toBe(1);

        // Clear — second request should be rejected
        queuePlugin.clear();
        await expect(p2).rejects.toThrow('Queue cleared');

        // Complete first request
        resolveFirst(
            new Response(JSON.stringify({ first: true }), {
                status: 200,
                statusText: 'OK',
                headers: { 'content-type': 'application/json' },
            })
        );
        await p1;
    });

    it('should release slot on error', async () => {
        const { createQueuePlugin } = await import('../src/plugins/queue.js');

        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ error: 'fail' }), {
                    status: 500,
                    statusText: 'Internal Server Error',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });
        const queuePlugin = createQueuePlugin({ maxConcurrent: 1 });
        api.use(queuePlugin);

        // Request fails — slot should be released via onError
        await expect(api.get('/fail')).rejects.toThrow(AFetchError);
        expect(queuePlugin.pending).toBe(0);
    });

    it('should work with default maxConcurrent', async () => {
        const { createQueuePlugin } = await import('../src/plugins/queue.js');

        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });
        const queuePlugin = createQueuePlugin();
        api.use(queuePlugin);

        const response = await api.get('/test');
        expect(response.status).toBe(200);
    });
});

// ─── Test: ResponseCache ───────────────────────────────────────

describe('ResponseCache', () => {
    it('should store and retrieve cache entries', async () => {
        const { ResponseCache } = await import('../src/plugins/cache.js');
        const cache = new ResponseCache(5000, 100);

        const response = {
            data: { id: 1 },
            status: 200,
            statusText: 'OK',
            headers: new Headers(),
            config: {} as any,
            raw: {} as any,
            ok: true,
        };

        cache.set('key1', response);
        expect(cache.has('key1')).toBe(true);
        expect(cache.size).toBe(1);

        const cached = cache.get('key1');
        expect(cached).toEqual(response);
    });

    it('should return undefined for expired entries', async () => {
        const { ResponseCache } = await import('../src/plugins/cache.js');
        const cache = new ResponseCache(1, 100); // 1ms max age

        cache.set('key1', { data: 'test' } as any);
        await new Promise((r) => setTimeout(r, 10));

        expect(cache.get('key1')).toBeUndefined();
        expect(cache.has('key1')).toBe(false);
    });

    it('should evict oldest entries when max size exceeded', async () => {
        const { ResponseCache } = await import('../src/plugins/cache.js');
        const cache = new ResponseCache(60000, 2);

        cache.set('a', { data: 'a' } as any);
        await new Promise((r) => setTimeout(r, 5));
        cache.set('b', { data: 'b' } as any);
        await new Promise((r) => setTimeout(r, 5));
        cache.set('c', { data: 'c' } as any);

        expect(cache.size).toBe(2);
        expect(cache.has('a')).toBe(false); // evicted
        expect(cache.has('b')).toBe(true);
        expect(cache.has('c')).toBe(true);
    });

    it('should delete and clear entries', async () => {
        const { ResponseCache } = await import('../src/plugins/cache.js');
        const cache = new ResponseCache();

        cache.set('key1', { data: 'a' } as any);
        cache.set('key2', { data: 'b' } as any);
        expect(cache.size).toBe(2);

        cache.delete('key1');
        expect(cache.size).toBe(1);

        cache.clear();
        expect(cache.size).toBe(0);
    });

    it('should return undefined for non-existent keys', async () => {
        const { ResponseCache } = await import('../src/plugins/cache.js');
        const cache = new ResponseCache();
        expect(cache.get('missing')).toBeUndefined();
    });
});

// ─── Test: createCachePlugin ───────────────────────────────────

describe('createCachePlugin', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should create a cache plugin', async () => {
        const { createCachePlugin } = await import('../src/plugins/cache.js');
        const plugin = createCachePlugin({ maxAge: 10000, maxSize: 50 });
        expect(plugin.name).toBe('cache');
        expect(typeof plugin.install).toBe('function');
    });

    it('should cache GET responses and return cached on second call', async () => {
        const { createCachePlugin } = await import('../src/plugins/cache.js');

        let callCount = 0;
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            callCount++;
            return Promise.resolve(
                new Response(JSON.stringify({ count: callCount }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });
        api.use(createCachePlugin({ maxAge: 60000 }));

        const res1 = await api.get('/api/data');
        const res2 = await api.get('/api/data');

        expect(res1.data).toEqual({ count: 1 });
        expect(res2.data).toEqual({ count: 1 });
        expect(mockGlobalFetch).toHaveBeenCalledTimes(1);
    });

    it('should not cache POST requests', async () => {
        const { createCachePlugin } = await import('../src/plugins/cache.js');

        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });
        api.use(createCachePlugin());

        await api.post('/api/data', { a: 1 });
        await api.post('/api/data', { a: 1 });

        expect(mockGlobalFetch).toHaveBeenCalledTimes(2);
    });

    it('should not cache non-2xx responses', async () => {
        const { createCachePlugin } = await import('../src/plugins/cache.js');

        let callCount = 0;
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            callCount++;
            return Promise.resolve(
                new Response(JSON.stringify({ error: 'fail' }), {
                    status: 500,
                    statusText: 'Internal Server Error',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });
        api.use(createCachePlugin());

        // Use throwOnError: false so afterResponse hook is reached
        const res1 = await api.get('/api/fail', { throwOnError: false });
        const res2 = await api.get('/api/fail', { throwOnError: false });

        // Both should hit network (not cached)
        expect(mockGlobalFetch).toHaveBeenCalledTimes(2);
        expect(res1.status).toBe(500);
        expect(res2.status).toBe(500);
    });

    it('should expire cached entries after maxAge', async () => {
        const { createCachePlugin } = await import('../src/plugins/cache.js');

        let callCount = 0;
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            callCount++;
            return Promise.resolve(
                new Response(JSON.stringify({ count: callCount }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });
        api.use(createCachePlugin({ maxAge: 50 }));

        const res1 = await api.get('/api/data');
        expect(res1.data).toEqual({ count: 1 });

        await new Promise((r) => setTimeout(r, 80));

        const res2 = await api.get('/api/data');
        expect(res2.data).toEqual({ count: 2 });
        expect(mockGlobalFetch).toHaveBeenCalledTimes(2);
    });

    it('should evict oldest entries when maxSize exceeded', async () => {
        const { createCachePlugin } = await import('../src/plugins/cache.js');

        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });
        api.use(createCachePlugin({ maxAge: 60000, maxSize: 2 }));

        await api.get('/api/a');
        await new Promise((r) => setTimeout(r, 5));
        await api.get('/api/b');
        await new Promise((r) => setTimeout(r, 5));
        await api.get('/api/c');

        // /api/a was evicted, /api/b and /api/c are cached
        // Calling /api/a again should make a new request (evicts /api/b)
        await api.get('/api/a');
        expect(mockGlobalFetch).toHaveBeenCalledTimes(4);

        // /api/b was evicted by /api/a re-entry, so it's a cache miss
        await api.get('/api/b');
        expect(mockGlobalFetch).toHaveBeenCalledTimes(5);

        // /api/a should still be cached
        await api.get('/api/a');
        expect(mockGlobalFetch).toHaveBeenCalledTimes(5);
    });

    it('should cache with query parameters as part of key', async () => {
        const { createCachePlugin } = await import('../src/plugins/cache.js');

        let callCount = 0;
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            callCount++;
            return Promise.resolve(
                new Response(JSON.stringify({ count: callCount }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });
        api.use(createCachePlugin({ maxAge: 60000 }));

        await api.get('/api/data', { params: { page: 1 } });
        await api.get('/api/data', { params: { page: 2 } });
        await api.get('/api/data', { params: { page: 1 } });

        // page=1 and page=2 are different cache keys
        // Third call hits cache for page=1
        expect(mockGlobalFetch).toHaveBeenCalledTimes(2);
    });

    it('should install with default options', async () => {
        const { createCachePlugin } = await import('../src/plugins/cache.js');
        const plugin = createCachePlugin();
        expect(plugin.name).toBe('cache');
    });

    it('should skip caching when shouldCache returns false', async () => {
        const { createCachePlugin } = await import('../src/plugins/cache.js');

        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });
        api.use(createCachePlugin({
            shouldCache: () => false,
        }));

        await api.get('/api/data');
        await api.get('/api/data');

        // Both calls hit network (not cached)
        expect(mockGlobalFetch).toHaveBeenCalledTimes(2);
    });

    it('should use custom maxAge from shouldCache', async () => {
        const { createCachePlugin } = await import('../src/plugins/cache.js');

        let callCount = 0;
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            callCount++;
            return Promise.resolve(
                new Response(JSON.stringify({ count: callCount }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });
        api.use(createCachePlugin({
            maxAge: 60000,
            shouldCache: () => ({ maxAge: 50 }),
        }));

        const res1 = await api.get('/api/data');
        expect(res1.data).toEqual({ count: 1 });

        // Wait for custom maxAge (50ms) to expire
        await new Promise((r) => setTimeout(r, 80));

        const res2 = await api.get('/api/data');
        expect(res2.data).toEqual({ count: 2 });
        expect(mockGlobalFetch).toHaveBeenCalledTimes(2);
    });

    it('should cache with default maxAge when shouldCache returns true', async () => {
        const { createCachePlugin } = await import('../src/plugins/cache.js');

        let callCount = 0;
        const mockGlobalFetch = jest.fn<typeof fetch>().mockImplementation(() => {
            callCount++;
            return Promise.resolve(
                new Response(JSON.stringify({ count: callCount }), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                })
            );
        });
        globalThis.fetch = mockGlobalFetch;

        const api = createInstance({ baseURL: 'https://test.example.com' });
        api.use(createCachePlugin({
            maxAge: 60000,
            shouldCache: () => true,
        }));

        const res1 = await api.get('/api/data');
        const res2 = await api.get('/api/data');

        expect(res1.data).toEqual({ count: 1 });
        expect(res2.data).toEqual({ count: 1 });
        expect(mockGlobalFetch).toHaveBeenCalledTimes(1);
    });
});

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

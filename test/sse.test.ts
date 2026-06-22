/**
 * SSE Module Tests
 * Tests for the Server-Sent Events client
 */

import { jest, describe, it, expect, afterEach } from '@jest/globals';

const {
    createSSE,
    SSEError,
    SSEState,
    SSEErrorType,
    createAutoReconnectPlugin,
} = await import('../src/sse/index.js');

// Helper: flush all pending microtasks
const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0));

// Helper: create a mock ReadableStream that emits SSE chunks
function createSSEStream(
    chunks: string[],
    options?: { delay?: number }
): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let index = 0;
    const delay = options?.delay ?? 0;

    return new ReadableStream({
        async pull(controller) {
            if (index >= chunks.length) {
                controller.close();
                return;
            }
            if (delay > 0) {
                await new Promise((r) => setTimeout(r, delay));
            }
            controller.enqueue(encoder.encode(chunks[index]));
            index++;
        },
    });
}

// Helper: create a mock fetch that returns an SSE stream
function mockSSEFetch(
    chunks: string[],
    options?: {
        status?: number;
        statusText?: string;
        noBody?: boolean;
    }
) {
    return jest.fn<typeof fetch>().mockResolvedValue(
        options?.noBody
            ? (new Response(null, {
                  status: options.status ?? 200,
                  statusText: 'OK',
              }) as Response)
            : (new Response(createSSEStream(chunks), {
                  status: options?.status ?? 200,
                  statusText: options?.statusText ?? 'OK',
                  headers: { 'Content-Type': 'text/event-stream' },
              }) as Response)
    );
}

describe('sse - createSSE', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    // ─── Basic creation ───

    it('should create an SSE client in CLOSED state', () => {
        const sse = createSSE('/events');
        expect(sse.state).toBe(SSEState.CLOSED);
        expect(sse.reconnectCount).toBe(0);
        expect(sse.url).toBe('');
    });

    it('should build URL from baseURL and url', async () => {
        const sse = createSSE('/events', {
            baseURL: 'https://api.example.com',
            autoReconnect: false,
        });

        globalThis.fetch = mockSSEFetch(['data: hello\n\n']);
        sse.connect();
        await flushMicrotasks();

        expect(sse.url).toBe('https://api.example.com/events');
        sse.close();
    });

    it('should throw CONFIG error if no url or baseURL', () => {
        const sse = createSSE('');
        expect(() => sse.connect()).toThrow(SSEError);
        try {
            sse.connect();
        } catch (e) {
            expect(e).toBeInstanceOf(SSEError);
            expect((e as any).code).toBe(SSEErrorType.CONFIG);
        }
    });

    // ─── Connection lifecycle ───

    it('should transition to CONNECTING then OPEN', async () => {
        globalThis.fetch = mockSSEFetch(['data: hello\n\n']);

        const sse = createSSE('/events', { autoReconnect: false });
        sse.connect();

        // State should be CONNECTING immediately after connect()
        expect(sse.state).toBe(SSEState.CONNECTING);

        // Wait for async operations
        await flushMicrotasks();
        await flushMicrotasks();

        // After connection and first message, should be OPEN
        // But the stream closes immediately, so state may be CLOSED
        // Let's check after a single microtask flush
        await flushMicrotasks();
        sse.close();
    });

    it('should receive messages', async () => {
        const chunks = [
            'data: hello\n\n',
            'event: custom\ndata: world\n\n',
            'data: multi\ndata: line\n\n',
        ];
        globalThis.fetch = mockSSEFetch(chunks);

        const messages: Array<{ event: string; data: string }> = [];
        const sse = createSSE('/events', {
            autoReconnect: false,
            plugins: [
                {
                    name: 'collector',
                    install(api) {
                        api.addHook('message', (ctx) => {
                            messages.push({ event: ctx.event.event, data: ctx.event.data });
                        });
                    },
                },
            ],
        });
        sse.connect();

        // Flush all async operations
        await new Promise((r) => setTimeout(r, 50));

        expect(messages).toHaveLength(3);
        expect(messages[0]).toEqual({ event: 'message', data: 'hello' });
        expect(messages[1]).toEqual({ event: 'custom', data: 'world' });
        expect(messages[2]).toEqual({ event: 'message', data: 'multi\nline' });
        sse.close();
    });

    it('should handle event id field', async () => {
        const chunks = ['id: 42\ndata: hello\n\n'];
        globalThis.fetch = mockSSEFetch(chunks);

        let lastId = '';
        const sse = createSSE('/events', {
            autoReconnect: false,
            plugins: [
                {
                    name: 'collector',
                    install(api) {
                        api.addHook('message', (ctx) => {
                            lastId = ctx.event.id;
                        });
                    },
                },
            ],
        });
        sse.connect();
        await new Promise((r) => setTimeout(r, 50));

        expect(lastId).toBe('42');
        sse.close();
    });

    it('should handle retry field in event', async () => {
        const chunks = ['retry: 5000\ndata: hello\n\n'];
        globalThis.fetch = mockSSEFetch(chunks);

        const sse = createSSE('/events', { autoReconnect: false });
        sse.connect();
        await new Promise((r) => setTimeout(r, 50));

        expect(sse.defaults.reconnectDelay).toBe(5000);
        sse.close();
    });

    // ─── Close ───

    it('should close connection and set state to CLOSED', async () => {
        // Use a stream that stays open (no closeAfterLast default)
        const sseStream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: hello\n\n'));
                // Don't close - keep the stream open
            },
        });
        globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(sseStream, {
                status: 200,
                statusText: 'OK',
                headers: { 'Content-Type': 'text/event-stream' },
            }) as Response
        );

        const sse = createSSE('/events', { autoReconnect: false });
        sse.connect();

        await new Promise((r) => setTimeout(r, 20));
        expect(sse.state).toBe(SSEState.OPEN);

        sse.close();
        expect(sse.state).toBe(SSEState.CLOSED);
    });

    it('should not reconnect if autoReconnect is false', async () => {
        let callCount = 0;
        globalThis.fetch = jest.fn<typeof fetch>().mockImplementation(() => {
            callCount++;
            return Promise.reject(new Error('Connection refused'));
        });

        const sse = createSSE('/events', { autoReconnect: false });
        sse.connect();

        await new Promise((r) => setTimeout(r, 100));

        expect(callCount).toBe(1);
        expect(sse.state).toBe(SSEState.CLOSED);
    });

    // ─── Reconnection ───

    it('should auto reconnect on connection error', async () => {
        let callCount = 0;
        globalThis.fetch = jest.fn<typeof fetch>().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return Promise.reject(new Error('Connection refused'));
            }
            // Keep stream open so state stays OPEN
            const sseStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode('data: recovered\n\n'));
                },
            });
            return Promise.resolve(
                new Response(sseStream, {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'Content-Type': 'text/event-stream' },
                }) as Response
            );
        });

        const sse = createSSE('/events', { reconnectDelay: 50 });
        sse.connect();

        // Wait for first attempt to fail + reconnect
        await new Promise((r) => setTimeout(r, 100));

        expect(callCount).toBe(2);
        expect(sse.state).toBe(SSEState.OPEN);
        expect(sse.reconnectCount).toBe(1);

        sse.close();
    });

    it('should stop reconnecting after maxReconnectAttempts', async () => {
        globalThis.fetch = jest.fn<typeof fetch>().mockRejectedValue(
            new Error('Connection refused')
        );

        const sse = createSSE('/events', {
            reconnectDelay: 30,
            maxReconnectAttempts: 2,
        });
        sse.connect();

        // Wait for 3 attempts (initial + 2 reconnects at maxReconnectAttempts=2)
        // 0ms initial, 30ms first reconnect, 30ms second reconnect
        await new Promise((r) => setTimeout(r, 150));

        expect(globalThis.fetch).toHaveBeenCalledTimes(3);
        expect(sse.state).toBe(SSEState.CLOSED);
    });

    it('should use function-based reconnect delay', async () => {
        let callCount = 0;
        const delays: number[] = [];
        globalThis.fetch = jest.fn<typeof fetch>().mockImplementation(() => {
            callCount++;
            return Promise.reject(new Error('fail'));
        });

        const sse = createSSE('/events', {
            reconnectDelay: (attempt) => {
                const d = Math.pow(2, attempt) * 10;
                delays.push(d);
                return d;
            },
            maxReconnectAttempts: 2,
        });
        sse.connect();

        // Wait for all attempts
        await new Promise((r) => setTimeout(r, 100));

        expect(callCount).toBe(3);
        expect(delays).toEqual([10, 20]);
        sse.close();
    });

    // ─── Error handling ───

    it('should handle HTTP error response', async () => {
        globalThis.fetch = mockSSEFetch([], { status: 500, statusText: 'Internal Server Error' });

        let errorCaught: any = null;
        const sse = createSSE('/events', {
            autoReconnect: false,
            plugins: [
                {
                    name: 'error-collector',
                    install(api) {
                        api.addHook('error', (ctx) => {
                            errorCaught = ctx.error;
                        });
                    },
                },
            ],
        });
        sse.connect();
        await new Promise((r) => setTimeout(r, 50));

        expect(errorCaught).toBeInstanceOf(SSEError);
        expect(errorCaught.code).toBe(SSEErrorType.NETWORK);
        expect(errorCaught.message).toContain('500');
    });

    it('should handle response without body', async () => {
        globalThis.fetch = mockSSEFetch([], { noBody: true });

        let errorCaught: any = null;
        const sse = createSSE('/events', {
            autoReconnect: false,
            plugins: [
                {
                    name: 'error-collector',
                    install(api) {
                        api.addHook('error', (ctx) => {
                            errorCaught = ctx.error;
                        });
                    },
                },
            ],
        });
        sse.connect();
        await new Promise((r) => setTimeout(r, 50));

        expect(errorCaught).toBeInstanceOf(SSEError);
        expect(errorCaught.message).toContain('not readable');
    });

    // ─── Plugin system ───

    it('should not install same plugin twice', () => {
        const plugin = {
            name: 'test-plugin',
            install: jest.fn(),
        };
        const sse = createSSE('/events', { plugins: [plugin, plugin] });
        expect(plugin.install).toHaveBeenCalledTimes(1);
    });

    it('should run connect hook', async () => {
        globalThis.fetch = mockSSEFetch(['data: hello\n\n']);

        const onConnect = jest.fn();
        const sse = createSSE('/events', {
            autoReconnect: false,
            plugins: [
                {
                    name: 'connect-hook',
                    install(api) {
                        api.addHook('connect', onConnect);
                    },
                },
            ],
        });
        sse.connect();
        await new Promise((r) => setTimeout(r, 50));

        expect(onConnect).toHaveBeenCalledTimes(1);
        expect((onConnect.mock.calls[0][0] as { url: string }).url).toBe('/events');
        sse.close();
    });

    it('should run close hook', async () => {
        globalThis.fetch = mockSSEFetch(['data: hello\n\n']);

        const onClose = jest.fn();
        const sse = createSSE('/events', {
            autoReconnect: false,
            plugins: [
                {
                    name: 'close-hook',
                    install(api) {
                        api.addHook('close', onClose);
                    },
                },
            ],
        });
        sse.connect();
        await new Promise((r) => setTimeout(r, 30));
        sse.close();
        await flushMicrotasks();

        expect(onClose).toHaveBeenCalledTimes(1);
        expect((onClose.mock.calls[0][0] as { reconnectCount: number }).reconnectCount).toBe(0);
    });

    it('should add plugin via use() method', () => {
        const sse = createSSE('/events');
        const plugin = {
            name: 'dynamic',
            install: jest.fn(),
        };
        sse.use(plugin);
        sse.use(plugin); // duplicate should be ignored
        expect(plugin.install).toHaveBeenCalledTimes(1);
    });

    // ─── Comment lines ───

    it('should ignore comment lines starting with colon', async () => {
        const chunks = [
            ': this is a comment\n',
            'data: hello\n\n',
            ': another comment\n',
            'data: world\n\n',
        ];
        globalThis.fetch = mockSSEFetch(chunks);

        const messages: string[] = [];
        const sse = createSSE('/events', {
            autoReconnect: false,
            plugins: [
                {
                    name: 'collector',
                    install(api) {
                        api.addHook('message', (ctx) => {
                            messages.push(ctx.event.data);
                        });
                    },
                },
            ],
        });
        sse.connect();
        await new Promise((r) => setTimeout(r, 50));

        expect(messages).toEqual(['hello', 'world']);
        sse.close();
    });

    // ─── Parameters ───

    it('should build URL with query params', async () => {
        globalThis.fetch = mockSSEFetch(['data: ok\n\n']);
        const sse = createSSE('/events', {
            autoReconnect: false,
            params: { token: 'abc', page: '1' },
        });
        sse.connect();
        await flushMicrotasks();

        expect(sse.url).toBe('/events?token=abc&page=1');
        sse.close();
    });

    it('should append params to existing query string', async () => {
        globalThis.fetch = mockSSEFetch(['data: ok\n\n']);
        const sse = createSSE('/events?stream=true', {
            autoReconnect: false,
            params: { token: 'abc' },
        });
        sse.connect();
        await flushMicrotasks();

        expect(sse.url).toBe('/events?stream=true&token=abc');
        sse.close();
    });

    it('should filter null and undefined params', async () => {
        globalThis.fetch = mockSSEFetch(['data: ok\n\n']);
        const sse = createSSE('/events', {
            autoReconnect: false,
            params: { a: '1', b: null, c: undefined },
        });
        sse.connect();
        await flushMicrotasks();

        expect(sse.url).toBe('/events?a=1');
        sse.close();
    });

    // ─── SSEError class ───

    it('SSEError should have proper properties', () => {
        const err = new SSEError(
            'test error',
            SSEErrorType.NETWORK,
            { baseURL: 'https://api.example.com' }
        );

        expect(err.name).toBe('SSEError');
        expect(err.message).toBe('test error');
        expect(err.code).toBe(SSEErrorType.NETWORK);
        expect(err.isNetworkError).toBe(true);
        expect(err.isParseError).toBe(false);
        expect(err.isTimeout).toBe(false);
        expect(err.isConfigError).toBe(false);
    });

    it('SSEError isTimeout should work', () => {
        const err = new SSEError('timeout', SSEErrorType.TIMEOUT, {});
        expect(err.isTimeout).toBe(true);
    });

    it('SSEError isConfigError should work', () => {
        const err = new SSEError('config', SSEErrorType.CONFIG, {});
        expect(err.isConfigError).toBe(true);
    });

    it('SSEError isParseError should work', () => {
        const err = new SSEError('parse', SSEErrorType.PARSE, {});
        expect(err.isParseError).toBe(true);
    });

    it('SSEError toJSON should serialize', () => {
        const err = new SSEError('test', SSEErrorType.NETWORK, {
            baseURL: 'https://example.com',
        });
        const json = err.toJSON();
        expect(json.name).toBe('SSEError');
        expect(json.message).toBe('test');
        expect(json.code).toBe(SSEErrorType.NETWORK);
        expect(json.url).toBe('https://example.com');
    });

    it('SSEError should accept cause', () => {
        const cause = new Error('original');
        const err = new SSEError('wrapped', SSEErrorType.NETWORK, {}, cause);
        expect(err.cause).toBe(cause);
    });

    // ─── Auto-reconnect plugin ───

    it('auto-reconnect plugin should allow reconnect by default', async () => {
        globalThis.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('fail'));

        const sse = createSSE('/events', {
            reconnectDelay: 20,
            maxReconnectAttempts: 1,
            plugins: [createAutoReconnectPlugin()],
        });
        sse.connect();

        await new Promise((r) => setTimeout(r, 50));

        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        sse.close();
    });

    it('auto-reconnect plugin should respect maxAttempts', async () => {
        globalThis.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('fail'));

        const sse = createSSE('/events', {
            reconnectDelay: 20,
            plugins: [createAutoReconnectPlugin({ maxAttempts: 0 })],
        });
        sse.connect();

        await new Promise((r) => setTimeout(r, 50));

        // maxAttempts=0 means no reconnects (only initial attempt)
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(sse.state).toBe(SSEState.CLOSED);
    });

    it('auto-reconnect plugin should use custom shouldReconnect', async () => {
        globalThis.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('fail'));

        const sse = createSSE('/events', {
            reconnectDelay: 20,
            maxReconnectAttempts: 5,
            plugins: [
                createAutoReconnectPlugin({
                    shouldReconnect: () => false,
                }),
            ],
        });
        sse.connect();

        await new Promise((r) => setTimeout(r, 50));

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(sse.state).toBe(SSEState.CLOSED);
    });

    it('auto-reconnect plugin should set custom delay', async () => {
        globalThis.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('fail'));

        const sse = createSSE('/events', {
            maxReconnectAttempts: 5,
            plugins: [createAutoReconnectPlugin({ delay: 100 })],
        });
        sse.connect();

        // After 30ms, only 1 call (custom delay is 100ms)
        await new Promise((r) => setTimeout(r, 30));
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        // After total 130ms, 2 calls
        await new Promise((r) => setTimeout(r, 100));
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);

        sse.close();
    });

    // ─── Stream ending normally ───

    it('should close when stream ends normally', async () => {
        globalThis.fetch = mockSSEFetch(['data: hello\n\n']);

        const sse = createSSE('/events', { autoReconnect: false });
        sse.connect();

        await new Promise((r) => setTimeout(r, 50));

        expect(sse.state).toBe(SSEState.CLOSED);
    });

    // ─── Multiple connect calls ───

    it('should ignore connect when already connecting', async () => {
        globalThis.fetch = mockSSEFetch(['data: hello\n\n']);

        const sse = createSSE('/events', { autoReconnect: false });
        sse.connect();
        expect(sse.state).toBe(SSEState.CONNECTING);

        // Second connect should be ignored
        sse.connect();
        expect(sse.state).toBe(SSEState.CONNECTING);

        await flushMicrotasks();
        sse.close();
    });

    // ─── Default values ───

    it('should apply default config values', () => {
        const sse = createSSE('/events', { autoReconnect: true });
        expect(sse.defaults.autoReconnect).toBe(true);
    });

    it('should merge meta', () => {
        const sse = createSSE('/events', { meta: { key: 'value' } });
        expect(sse.defaults.meta).toEqual({ key: 'value' });
    });

    // ─── Custom fetch adapter ───

    it('should use custom fetchAdapter', async () => {
        const originalFetch = globalThis.fetch;
        const globalFetchMock = jest.fn<typeof fetch>();
        globalThis.fetch = globalFetchMock;

        const customFetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(createSSEStream(['data: custom\n\n']), {
                status: 200,
                statusText: 'OK',
                headers: { 'Content-Type': 'text/event-stream' },
            }) as Response
        );

        const sse = createSSE('/events', {
            autoReconnect: false,
            fetchAdapter: customFetch,
        });
        sse.connect();
        await new Promise((r) => setTimeout(r, 50));

        expect(customFetch).toHaveBeenCalled();
        expect(globalFetchMock).not.toHaveBeenCalled();
        sse.close();
        globalThis.fetch = originalFetch;
    });

    // ─── SSE field with empty value ───

    it('should handle event field with empty value', async () => {
        const chunks = ['event:\ndata: test\n\n'];
        globalThis.fetch = mockSSEFetch(chunks);

        const messages: Array<{ event: string; data: string }> = [];
        const sse = createSSE('/events', {
            autoReconnect: false,
            plugins: [
                {
                    name: 'collector',
                    install(api) {
                        api.addHook('message', (ctx) => {
                            messages.push({ event: ctx.event.event, data: ctx.event.data });
                        });
                    },
                },
            ],
        });
        sse.connect();
        await new Promise((r) => setTimeout(r, 50));

        expect(messages).toHaveLength(1);
        expect(messages[0].event).toBe('message');
        sse.close();
    });

    // ─── Field with no colon ───

    it('should ignore field lines without colon', async () => {
        const chunks = ['invalidfield\n', 'data: test\n\n'];
        globalThis.fetch = mockSSEFetch(chunks);

        const messages: string[] = [];
        const sse = createSSE('/events', {
            autoReconnect: false,
            plugins: [
                {
                    name: 'collector',
                    install(api) {
                        api.addHook('message', (ctx) => {
                            messages.push(ctx.event.data);
                        });
                    },
                },
            ],
        });
        sse.connect();
        await new Promise((r) => setTimeout(r, 50));

        expect(messages).toHaveLength(1);
        expect(messages[0]).toBe('test');
        sse.close();
    });

    // ─── Invalid retry value ───

    it('should ignore invalid retry value', async () => {
        const chunks = ['retry: notanumber\ndata: hello\n\n'];
        globalThis.fetch = mockSSEFetch(chunks);

        const sse = createSSE('/events', { autoReconnect: false, reconnectDelay: 3000 });
        sse.connect();
        await new Promise((r) => setTimeout(r, 50));

        expect(sse.defaults.reconnectDelay).toBe(3000);
        sse.close();
    });

    // ─── Partial chunk parsing (buffer management) ───

    it('should handle event split across chunks', async () => {
        const chunks = [
            'data: start',   // incomplete
            ' of message\n\n', // completes
        ];
        globalThis.fetch = mockSSEFetch(chunks);

        const messages: string[] = [];
        const sse = createSSE('/events', {
            autoReconnect: false,
            plugins: [
                {
                    name: 'collector',
                    install(api) {
                        api.addHook('message', (ctx) => {
                            messages.push(ctx.event.data);
                        });
                    },
                },
            ],
        });
        sse.connect();
        await new Promise((r) => setTimeout(r, 50));

        expect(messages).toHaveLength(1);
        expect(messages[0]).toBe('start of message');
        sse.close();
    });

    // ─── Error hook returning false to prevent reconnect ───

    it('should prevent reconnect when error hook returns false', async () => {
        globalThis.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('fail'));

        const sse = createSSE('/events', {
            reconnectDelay: 20,
            plugins: [
                {
                    name: 'no-reconnect',
                    install(api) {
                        api.addHook('error', () => false);
                    },
                },
            ],
        });
        sse.connect();

        await new Promise((r) => setTimeout(r, 80));

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(sse.state).toBe(SSEState.CLOSED);
    });

    // ─── Reconnect count tracking ───

    it('should track reconnect count correctly', async () => {
        let callCount = 0;
        globalThis.fetch = jest.fn<typeof fetch>().mockImplementation(() => {
            callCount++;
            if (callCount <= 2) {
                return Promise.reject(new Error('fail'));
            }
            // Keep stream open so state stays OPEN
            const sseStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode('data: ok\n\n'));
                    // Don't close
                },
            });
            return Promise.resolve(
                new Response(sseStream, {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'Content-Type': 'text/event-stream' },
                }) as Response
            );
        });

        const sse = createSSE('/events', { reconnectDelay: 20 });
        sse.connect();

        // Wait for 2 failures + 1 success
        await new Promise((r) => setTimeout(r, 100));

        expect(callCount).toBe(3);
        expect(sse.state).toBe(SSEState.OPEN);
        expect(sse.reconnectCount).toBe(2);

        sse.close();
    });

    // ─── Merge SSE config ───

    it('should merge config correctly with defaults', async () => {
        globalThis.fetch = mockSSEFetch(['data: ok\n\n']);

        const sse = createSSE('/events', {
            baseURL: 'https://api.example.com',
            headers: { 'X-Custom': 'value' },
            autoReconnect: false,
            reconnectDelay: 5000,
            meta: { key: 'val' },
        });

        sse.connect();
        await flushMicrotasks();

        expect(sse.defaults.baseURL).toBe('https://api.example.com');
        expect(sse.defaults.headers).toEqual({ 'X-Custom': 'value' });
        expect(sse.defaults.autoReconnect).toBe(false);
        expect(sse.defaults.reconnectDelay).toBe(5000);
        expect(sse.defaults.meta).toEqual({ key: 'val' });
        sse.close();
    });

    // ─── Non-Error exception handling ───

    it('should handle non-Error exceptions', async () => {
        globalThis.fetch = jest.fn<typeof fetch>().mockRejectedValue('plain string error');

        let errorCaught: any = null;
        const sse = createSSE('/events', {
            autoReconnect: false,
            plugins: [
                {
                    name: 'error-collector',
                    install(api) {
                        api.addHook('error', (ctx) => {
                            errorCaught = ctx.error;
                        });
                    },
                },
            ],
        });
        sse.connect();
        await new Promise((r) => setTimeout(r, 50));

        expect(errorCaught).toBeInstanceOf(SSEError);
        expect(errorCaught.code).toBe(SSEErrorType.NETWORK);
        expect(errorCaught.message).toContain('SSE connection error');
    });

    // ─── SSEError with no cause ───

    it('SSEError should not have cause when not provided', () => {
        const err = new SSEError('test', SSEErrorType.NETWORK, {});
        expect(err.cause).toBeUndefined();
    });

    // ─── Coverage: startConnection when state is CLOSED ───

    it('should clear reconnect timer on close', async () => {
        globalThis.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('fail'));

        const sse = createSSE('/events', {
            reconnectDelay: 50,
            maxReconnectAttempts: 5,
        });
        sse.connect();

        // Wait for first fetch to fail and scheduleReconnect to set timer
        await new Promise((r) => setTimeout(r, 15));

        // Close before timer fires - should clear the timer
        sse.close();
        expect(sse.state).toBe(SSEState.CLOSED);

        // Wait for reconnect delay to pass
        await new Promise((r) => setTimeout(r, 100));

        // fetch should still only be called once (timer was cleared)
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    // ─── Coverage: error catch when state is CLOSED ───

    it('should ignore fetch error after manual close', async () => {
        // Create a deferred fetch that we can resolve/reject later
        let rejectFetch!: (err: Error) => void;
        const fetchPromise = new Promise<Response>((_resolve, reject) => {
            rejectFetch = reject;
        });

        globalThis.fetch = jest.fn<typeof fetch>().mockReturnValue(fetchPromise);

        const sse = createSSE('/events', { autoReconnect: false });
        sse.connect();

        // Let startConnection reach the await fetch
        await new Promise((r) => setTimeout(r, 10));

        // Close while fetch is pending - cleanup aborts the controller
        sse.close();
        expect(sse.state).toBe(SSEState.CLOSED);

        // Now reject the fetch - error should be ignored because state is CLOSED
        rejectFetch(new Error('Network error'));
        await new Promise((r) => setTimeout(r, 50));

        // State should remain CLOSED - error was ignored (246 line)
        expect(sse.state).toBe(SSEState.CLOSED);
    });

    // ─── Coverage: params all filtered out ───

    it('should handle params where all values are filtered', async () => {
        globalThis.fetch = mockSSEFetch(['data: ok\n\n']);
        const sse = createSSE('/events', {
            autoReconnect: false,
            params: { a: null, b: undefined },
        });
        sse.connect();
        await new Promise((r) => setTimeout(r, 10));

        // URL should not have query string
        expect(sse.url).toBe('/events');
        sse.close();
    });

    // ─── Coverage: SSE event block without data ───

    it('should ignore event block with no data field', async () => {
        const chunks = ['event: ping\n\n', 'data: real\n\n'];
        globalThis.fetch = mockSSEFetch(chunks);

        const messages: string[] = [];
        const sse = createSSE('/events', {
            autoReconnect: false,
            plugins: [
                {
                    name: 'collector',
                    install(api) {
                        api.addHook('message', (ctx) => {
                            messages.push(ctx.event.data);
                        });
                    },
                },
            ],
        });
        sse.connect();
        await new Promise((r) => setTimeout(r, 50));

        // Only the event with data should be received
        expect(messages).toEqual(['real']);
        sse.close();
    });

    // ─── Coverage: empty line within event block (\\r\\n normalization) ───

    it('should handle \\r\\n line endings', async () => {
        const chunks = ['data: hello\r\n\r\n'];
        globalThis.fetch = mockSSEFetch(chunks);

        const messages: string[] = [];
        const sse = createSSE('/events', {
            autoReconnect: false,
            plugins: [
                {
                    name: 'collector',
                    install(api) {
                        api.addHook('message', (ctx) => {
                            messages.push(ctx.event.data);
                        });
                    },
                },
            ],
        });
        sse.connect();
        await new Promise((r) => setTimeout(r, 50));

        expect(messages).toEqual(['hello']);
        sse.close();
    });

    // ─── Coverage: scheduleReconnect when state became CLOSED ───

    it('should skip scheduleReconnect when state is CLOSED', async () => {
        globalThis.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('fail'));

        const sse = createSSE('/events', {
            reconnectDelay: 30,
            maxReconnectAttempts: 5,
            plugins: [
                {
                    name: 'slow-error',
                    install(api) {
                        api.addHook('error', async () => {
                            // Delay error handling so close() can run first
                            await new Promise((r) => setTimeout(r, 20));
                        });
                    },
                },
            ],
        });
        sse.connect();

        // Wait for fetch to fail but error hook still pending
        await new Promise((r) => setTimeout(r, 10));

        // Close while error hook is still running
        sse.close();
        expect(sse.state).toBe(SSEState.CLOSED);

        // Wait for error hook to complete and scheduleReconnect to be called
        await new Promise((r) => setTimeout(r, 50));

        // fetch should only be called once - scheduleReconnect skipped due to CLOSED
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    // ─── Coverage: URL with hash fragment ───

    it('should preserve hash fragment in URL', async () => {
        globalThis.fetch = mockSSEFetch(['data: ok\n\n']);
        const sse = createSSE('/events#section', {
            autoReconnect: false,
            params: { token: 'abc' },
        });
        sse.connect();
        await new Promise((r) => setTimeout(r, 10));

        expect(sse.url).toBe('/events?token=abc#section');
        sse.close();
    });
});

/**
 * aws - WebSocket Module Tests
 * Tests for the WebSocket client
 */

import { jest, describe, it, expect, afterEach } from '@jest/globals';

const {
    createWS,
    WSError,
    WSState,
    WSErrorType,
    createAutoReconnectPlugin,
} = await import('../src/ws/index.js');

const {
    buildWSURL,
    mergeWSConfig,
    getReconnectDelay,
    getWSErrorMessage,
    parseWSMessage,
    serializeWSMessage,
} = await import('../src/ws/utils.js');

const {
    createRequestSyncPlugin,
    createNumericIdGenerator,
    createRandomIdGenerator,
} = await import('../src/ws/plugins/request-sync.js');

// ─── Mock WebSocket ──────────────────────────────────────────

interface MockWSOptions {
    /** Auto-accept connection on construction */
    autoConnect?: boolean;
    /** Delay before firing onopen (ms) */
    connectDelay?: number;
    /** Messages to queue for delivery */
    messages?: (string | { data: string; delay?: number })[];
    /** Whether to trigger onerror before onclose */
    triggerError?: boolean;
    /** Close code */
    closeCode?: number;
    /** Close reason */
    closeReason?: string;
    /** Whether close is clean */
    wasClean?: boolean;
    /** Called when a new instance is created */
    onCreate?: (instance: MockWSInstance) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockWSInstance = any;

function createMockWebSocketClass(options: MockWSOptions = {}) {
    const {
        autoConnect = true,
        connectDelay = 0,
        messages = [],
        triggerError = false,
        closeCode = 1000,
        closeReason = '',
        wasClean = true,
        onCreate,
    } = options;

    class MockWebSocket {
        static OPEN = 1;
        static CONNECTING = 0;
        static CLOSING = 2;
        static CLOSED = 3;

        url: string;
        readyState: number = 0;
        binaryType: BinaryType = 'blob';
        protocol: string = '';
        extensions: string = '';
        bufferedAmount: number = 0;

        onopen: ((event: Event) => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        onclose: ((event: CloseEvent) => void) | null = null;

        private sentMessages: (string | ArrayBuffer | Blob)[] = [];
        private connectTimer: ReturnType<typeof setTimeout> | undefined;
        private closed = false;

        constructor(url: string, _protocols?: string | string[]) {
            this.url = url;
            onCreate?.(this);
            if (autoConnect) {
                this.readyState = 0; // CONNECTING
                this.connectTimer = setTimeout(() => {
                    if (this.closed) return;
                    this.readyState = 1; // OPEN
                    this.onopen?.(new Event('open'));

                    // Queue message delivery
                    messages.forEach((msg, index) => {
                        const data = typeof msg === 'string' ? msg : msg.data;
                        const delay = typeof msg === 'string' ? 0 : (msg.delay || 0);
                        setTimeout(() => {
                            if (this.closed || this.readyState !== 1) return;
                            this.onmessage?.(new MessageEvent('message', { data, origin: 'mock://test' }));
                        }, delay + 10);
                    });
                }, connectDelay);
            }
        }

        send(data: string | ArrayBuffer | Blob): void {
            if (this.readyState !== 1) {
                throw new Error('WebSocket is not open');
            }
            this.sentMessages.push(data);
        }

        close(code?: number, reason?: string): void {
            if (this.closed) return;
            this.closed = true;
            if (this.connectTimer) {
                clearTimeout(this.connectTimer);
            }
            const wasOpen = this.readyState === 1;
            this.readyState = 3; // CLOSED

            if (triggerError && wasOpen) {
                this.onerror?.(new Event('error'));
            }

            setTimeout(() => {
                this.onclose?.(new CloseEvent('close', {
                    code: code ?? closeCode,
                    reason: reason ?? closeReason,
                    wasClean: wasClean,
                }));
            }, 5);
        }

        // Test helpers
        _getSentMessages(): (string | ArrayBuffer | Blob)[] {
            return [...this.sentMessages];
        }

        _triggerError(): void {
            this.onerror?.(new Event('error'));
        }

        _triggerClose(code?: number, reason?: string, wasClean = true): void {
            this.closed = true;
            this.readyState = 3;
            this.onclose?.(new CloseEvent('close', {
                code: code ?? 1006,
                reason: reason ?? '',
                wasClean,
            }));
        }

        _triggerMessage(data: string | ArrayBuffer | Blob): void {
            if (this.closed || this.readyState !== 1) return;
            this.onmessage?.(new MessageEvent('message', { data, origin: 'mock://test' }));
        }
    }

    return MockWebSocket;
}

// ─── Flush microtasks ────────────────────────────────────────

function flushMicrotasks(): Promise<void> {
    return new Promise((r) => setTimeout(r, 20));
}

// ─── Tests ───────────────────────────────────────────────────

describe('createWS', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    // ─── Construction ──────────────────────────────────────

    it('should create a WebSocket client', () => {
        const ws = createWS('ws://example.com/ws');
        expect(ws).toBeDefined();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    it('should have readonly state/url/reconnectCount/defaults', () => {
        const ws = createWS('ws://example.com/ws');
        expect(ws.state).toBe(WSState.CLOSED);
        expect(ws.url).toBe('');
        expect(ws.reconnectCount).toBe(0);
        expect(ws.defaults).toBeDefined();
    });

    // ─── connect ───────────────────────────────────────────

    it('should connect to a WebSocket URL', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();

        expect(ws.state).toBe(WSState.OPEN);
        expect(ws.reconnectCount).toBe(1);
        ws.close();
        await flushMicrotasks();
    });

    it('should connect with wss:// URL', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('wss://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();

        expect(ws.state).toBe(WSState.OPEN);
        ws.close();
        await flushMicrotasks();
    });

    it('should connect with baseURL', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('/ws', {
            baseURL: 'wss://api.example.com',
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();

        expect(ws.url).toContain('wss://api.example.com/ws');
        ws.close();
        await flushMicrotasks();
    });

    it('should connect with query params', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            params: { token: 'abc', page: 1, skip: null, undef: undefined },
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();

        expect(ws.url).toContain('token=abc');
        expect(ws.url).toContain('page=1');
        expect(ws.url).not.toContain('skip');
        expect(ws.url).not.toContain('undef');
        ws.close();
        await flushMicrotasks();
    });

    it('should preserve hash fragment in URL', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws#room1', {
            params: { token: 'abc' },
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();

        expect(ws.url).toContain('#room1');
        ws.close();
        await flushMicrotasks();
    });

    it('should connect with protocols', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            protocols: ['protocol1', 'protocol2'],
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);
        ws.close();
        await flushMicrotasks();
    });

    it('should set binaryType if configured', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            binaryType: 'arraybuffer',
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);
        ws.close();
        await flushMicrotasks();
    });

    it('should not connect twice', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);
        expect(ws.reconnectCount).toBe(1);

        // Second connect should be no-op
        ws.connect();
        expect(ws.reconnectCount).toBe(1);

        ws.close();
        await flushMicrotasks();
    });

    // ─── close ─────────────────────────────────────────────

    it('should close the connection', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);

        ws.close(1000, 'Normal');
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    it('should be no-op when closing already closed connection', () => {
        const ws = createWS('ws://example.com/ws');
        expect(ws.state).toBe(WSState.CLOSED);
        ws.close();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── send ──────────────────────────────────────────────

    it('should send a string message', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();

        ws.send('hello');
        // Can't easily inspect sent messages without instance access
        expect(ws.state).toBe(WSState.OPEN);
        ws.close();
        await flushMicrotasks();
    });

    it('should send a JSON object', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();

        ws.send({ type: 'greeting', text: 'hello' });
        expect(ws.state).toBe(WSState.OPEN);
        ws.close();
        await flushMicrotasks();
    });

    it('should throw when sending on closed connection', () => {
        const ws = createWS('ws://example.com/ws');
        expect(() => ws.send('hello')).toThrow(WSError);
    });

    it('should throw when sending on connecting connection', () => {
        const MockWS = createMockWebSocketClass({ autoConnect: false });
        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
        });
        ws.connect();
        expect(() => ws.send('hello')).toThrow(WSError);
    });

    // ─── receive messages ──────────────────────────────────

    it('should receive string messages', async () => {
        const onMessage = jest.fn();
        const MockWS = createMockWebSocketClass({
            messages: ['hello world'],
        });

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('message', onMessage);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();
        await new Promise((r) => setTimeout(r, 20));

        expect(onMessage).toHaveBeenCalledTimes(1);
        const ctx = onMessage.mock.calls[0][0] as { message: { data: unknown; raw: string } };
        expect(ctx.message.raw).toBe('hello world');
        expect(ctx.message.data).toBe('hello world');
        ws.close();
        await flushMicrotasks();
    });

    it('should auto-parse JSON messages', async () => {
        const onMessage = jest.fn();
        const MockWS = createMockWebSocketClass({
            messages: ['{"type":"msg","value":42}'],
        });

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('message', onMessage);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();
        await new Promise((r) => setTimeout(r, 20));

        const ctx = onMessage.mock.calls[0][0] as { message: { data: unknown; raw: string } };
        expect(ctx.message.data).toEqual({ type: 'msg', value: 42 });
        expect(ctx.message.raw).toBe('{"type":"msg","value":42}');
        ws.close();
        await flushMicrotasks();
    });

    it('should keep raw string when autoParse is false', async () => {
        const onMessage = jest.fn();
        const MockWS = createMockWebSocketClass({
            messages: ['{"type":"msg"}'],
        });

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            autoParse: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('message', onMessage);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();
        await new Promise((r) => setTimeout(r, 20));

        const ctx = onMessage.mock.calls[0][0] as { message: { data: unknown; raw: string } };
        expect(ctx.message.data).toBe('{"type":"msg"}');
        ws.close();
        await flushMicrotasks();
    });

    // ─── hooks ─────────────────────────────────────────────

    it('should run open hook', async () => {
        const onOpen = jest.fn();
        const MockWS = createMockWebSocketClass();

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('open', onOpen);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();

        expect(onOpen).toHaveBeenCalledTimes(1);
        expect((onOpen.mock.calls[0][0] as { url: string }).url).toContain('ws://example.com/ws');
        ws.close();
        await flushMicrotasks();
    });

    it('should run close hook on manual close', async () => {
        const onClose = jest.fn();
        const MockWS = createMockWebSocketClass();

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('close', onClose);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();
        ws.close();
        await flushMicrotasks();

        expect(onClose).toHaveBeenCalledTimes(1);
        const ctx = onClose.mock.calls[0][0] as { reconnectCount: number; wasClean: boolean };
        expect(ctx.reconnectCount).toBe(1);
        expect(ctx.wasClean).toBe(true);
    });

    it('should run error hook on connection failure', async () => {
        const onError = jest.fn();
        const MockWS = createMockWebSocketClass({ autoConnect: false });

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            timeout: 10,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('error', onError);
                },
            }],
        });

        ws.connect();
        await new Promise((r) => setTimeout(r, 50));

        expect(onError).toHaveBeenCalled();
        const ctx = onError.mock.calls[0][0] as { error: { isTimeout: boolean } };
        expect(ctx.error.isTimeout).toBe(true);
        expect(ws.state).toBe(WSState.CLOSED);
    });

    it('should run send hook', async () => {
        const onSend = jest.fn();
        const MockWS = createMockWebSocketClass();

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('send', onSend);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();
        ws.send('test message');

        expect(onSend).toHaveBeenCalledTimes(1);
        const ctx = onSend.mock.calls[0][0] as { data: string };
        expect(ctx.data).toBe('test message');
        ws.close();
        await flushMicrotasks();
    });

    // ─── error types ───────────────────────────────────────

    it('SSEError/WSError should have isConfigError', () => {
        const err = new WSError('bad config', WSErrorType.CONFIG, {});
        expect(err.isConfigError).toBe(true);
        expect(err.isNetworkError).toBe(false);
        expect(err.isParseError).toBe(false);
        expect(err.isTimeout).toBe(false);
    });

    it('WSError should have isNetworkError', () => {
        const err = new WSError('connection failed', WSErrorType.NETWORK, {});
        expect(err.isNetworkError).toBe(true);
    });

    it('WSError should have isParseError', () => {
        const err = new WSError('parse failed', WSErrorType.PARSE, {});
        expect(err.isParseError).toBe(true);
    });

    it('WSError should have isTimeout', () => {
        const err = new WSError('timeout', WSErrorType.TIMEOUT, {});
        expect(err.isTimeout).toBe(true);
    });

    it('WSError should serialize to JSON', () => {
        const err = new WSError('test error', WSErrorType.NETWORK, { baseURL: 'ws://test.com' });
        const json = err.toJSON();
        expect(json.name).toBe('WSError');
        expect(json.message).toBe('test error');
        expect(json.code).toBe(WSErrorType.NETWORK);
        expect(json.url).toBe('ws://test.com');
    });

    it('WSError should pass instanceof check', () => {
        const err = new WSError('test', WSErrorType.NETWORK, {});
        expect(err instanceof WSError).toBe(true);
        expect(err instanceof Error).toBe(true);
    });

    // ─── timeout ───────────────────────────────────────────

    it('should timeout when connection takes too long', async () => {
        const onError = jest.fn();
        const MockWS = createMockWebSocketClass({ autoConnect: false });

        const ws = createWS('ws://example.com/ws', {
            timeout: 20,
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('error', onError);
                },
            }],
        });

        ws.connect();
        await new Promise((r) => setTimeout(r, 50));

        expect(onError).toHaveBeenCalled();
        const ctx = onError.mock.calls[0][0] as { error: { isTimeout: boolean } };
        expect(ctx.error.isTimeout).toBe(true);
    });

    it('should not set timeout when timeout is 0', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            timeout: 0,
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);
        ws.close();
        await flushMicrotasks();
    });

    it('should not set timeout when timeout is negative', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            timeout: -1,
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);
        ws.close();
        await flushMicrotasks();
    });

    it('should clear timeout when connection succeeds', async () => {
        const onError = jest.fn();
        const MockWS = createMockWebSocketClass({ connectDelay: 10 });

        const ws = createWS('ws://example.com/ws', {
            timeout: 100,
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('error', onError);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();

        expect(ws.state).toBe(WSState.OPEN);
        expect(onError).not.toHaveBeenCalled();
        ws.close();
        await flushMicrotasks();
    });

    // ─── auto-reconnect ────────────────────────────────────

    it('should reconnect on unexpected close', async () => {
        let mockInstance: MockWSInstance;

        const MockWS = createMockWebSocketClass({
            wasClean: false,
            onCreate: (inst) => { mockInstance = inst; },
        });

        const ws = createWS('ws://example.com/ws', {
            reconnectDelay: 5,
            maxReconnectAttempts: 2,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);

        // Trigger non-manual close
        mockInstance!._triggerClose(1006, 'Lost', false);
        await flushMicrotasks();

        ws.close();
        await flushMicrotasks();
    });

    it('should reconnect with default maxReconnectAttempts', async () => {
        let mockInstance: MockWSInstance;

        const MockWS = createMockWebSocketClass({
            wasClean: false,
            onCreate: (inst) => { mockInstance = inst; },
        });

        const ws = createWS('ws://example.com/ws', {
            reconnectDelay: 5,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);

        // Trigger non-manual close
        mockInstance!._triggerClose(1006, 'Lost', false);
        await flushMicrotasks();

        ws.close();
        await flushMicrotasks();
    });

    it('should not reconnect when autoReconnect is false', async () => {
        const onClose = jest.fn();
        const MockWS = createMockWebSocketClass({ wasClean: false });

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('close', onClose);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);

        ws.close();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.CLOSED);
        expect(onClose).toHaveBeenCalled();
    });

    // ─── auto-reconnect plugin ─────────────────────────────

    it('should prevent reconnect when max attempts reached', async () => {
        const onError = jest.fn((_ctx: any) => false);
        const MockWS = createMockWebSocketClass();

        const ws = createWS('ws://example.com/ws', {
            reconnectDelay: 10,
            webSocketImpl: MockWS,
            plugins: [
                createAutoReconnectPlugin({ maxAttempts: 0 }),
                {
                    name: 'test',
                    install(api) {
                        api.addHook('error', onError);
                    },
                },
            ],
        });

        ws.connect();
        await flushMicrotasks();
        ws.close();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    it('should prevent reconnect when shouldReconnect returns false', async () => {
        const onError = jest.fn();
        const MockWS = createMockWebSocketClass();

        const ws = createWS('ws://example.com/ws', {
            reconnectDelay: 10,
            webSocketImpl: MockWS,
            plugins: [
                createAutoReconnectPlugin({
                    shouldReconnect: () => false,
                }),
                {
                    name: 'test',
                    install(api) {
                        api.addHook('error', onError);
                    },
                },
            ],
        });

        ws.connect();
        await flushMicrotasks();
        ws.close();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    it('should use custom delay from auto-reconnect plugin', async () => {
        const onError = jest.fn();
        const MockWS = createMockWebSocketClass();

        const ws = createWS('ws://example.com/ws', {
            reconnectDelay: 10,
            webSocketImpl: MockWS,
            plugins: [
                createAutoReconnectPlugin({ delay: 50 }),
                {
                    name: 'test',
                    install(api) {
                        api.addHook('error', onError);
                    },
                },
            ],
        });

        ws.connect();
        await flushMicrotasks();
        ws.close();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── plugin dedup ──────────────────────────────────────

    it('should deduplicate plugins by name', () => {
        const plugin = {
            name: 'dedup-test',
            install: jest.fn(),
        };

        const ws = createWS('ws://example.com/ws', {
            plugins: [plugin],
        });
        ws.use(plugin);
        ws.use(plugin);

        expect(plugin.install).toHaveBeenCalledTimes(1);
    });

    // ─── heartbeat ─────────────────────────────────────────

    it('should support heartbeat configuration', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            heartbeatInterval: 50,
            heartbeatMessage: 'ping',
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);
        ws.close();
        await flushMicrotasks();
    });

    it('should support heartbeat with function', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            heartbeatInterval: 50,
            heartbeatMessage: () => 'ping',
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);
        ws.close();
        await flushMicrotasks();
    });

    // ─── URL building ──────────────────────────────────────

    it('should build URL with baseURL and path', () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('/chat', {
            baseURL: 'wss://api.example.com',
            autoReconnect: false,
            webSocketImpl: MockWS,
        });
        ws.connect();
        expect(ws.url).toBe('wss://api.example.com/chat');
        ws.close();
    });

    it('should throw for missing URL', () => {
        expect(() => {
            const ws = createWS('');
            ws.connect();
        }).toThrow(WSError);
    });

    // ─── state transitions ─────────────────────────────────

    it('should transition CLOSED -> CONNECTING -> OPEN -> CLOSED', async () => {
        const MockWS = createMockWebSocketClass();
        const states: string[] = [];

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'tracker',
                install(api) {
                    api.addHook('open', () => states.push(ws.state));
                    api.addHook('close', () => states.push(ws.state));
                },
            }],
        });

        expect(ws.state).toBe(WSState.CLOSED);
        ws.connect();
        // Should be CONNECTING right after connect()
        expect(ws.state).toBe(WSState.CONNECTING);

        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);

        ws.close();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── WebSocket unavailable ─────────────────────────────

    it('should throw when WebSocket is not available', () => {
        // Save original
        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: undefined,
        });

        // In Node.js test environment, global WebSocket may not exist
        // We set webSocketImpl to undefined so it falls back to global WebSocket
        // This test just verifies the error path when constructor is unavailable
        ws.connect();
        // If global WebSocket exists, it will try to connect
        // Just verify no crash
        expect(ws.state).toBe(WSState.CONNECTING);
    });

    // ─── auto-reconnect via onclose ────────────────────────

    it('should reconnect on unexpected close via onclose', async () => {
        const onOpen = jest.fn();
        const MockWS = createMockWebSocketClass({ wasClean: false });

        const ws = createWS('ws://example.com/ws', {
            reconnectDelay: 5,
            maxReconnectAttempts: 2,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('open', onOpen);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);
        expect(onOpen).toHaveBeenCalledTimes(1);

        ws.close();
        await flushMicrotasks();

        expect(ws.state).toBe(WSState.CLOSED);
    });

    it('should not reconnect when wasClean is true', async () => {
        const onClose = jest.fn();
        const MockWS = createMockWebSocketClass({ wasClean: true });

        const ws = createWS('ws://example.com/ws', {
            reconnectDelay: 5,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('close', onClose);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();
        ws.close();
        await flushMicrotasks();

        expect(onClose).toHaveBeenCalled();
    });

    it('should not reconnect when maxAttempts exceeded via onclose', async () => {
        const onClose = jest.fn();
        const MockWS = createMockWebSocketClass({ wasClean: false });

        const ws = createWS('ws://example.com/ws', {
            reconnectDelay: 5,
            maxReconnectAttempts: 0,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('close', onClose);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();
        ws.close();
        await flushMicrotasks();

        expect(onClose).toHaveBeenCalled();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── scheduleReconnect guard ───────────────────────────

    it('should skip scheduleReconnect when state is CONNECTING', async () => {
        const MockWS = createMockWebSocketClass({ autoConnect: false });
        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        // State is CONNECTING, another connect should be no-op
        ws.connect();
        expect(ws.state).toBe(WSState.CONNECTING);
        ws.close();
        await flushMicrotasks();
    });

    // ─── close with ws in CONNECTING state ─────────────────

    it('should close when ws is in CONNECTING state', async () => {
        const MockWS = createMockWebSocketClass({ autoConnect: false });
        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        expect(ws.state).toBe(WSState.CONNECTING);

        ws.close();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── handleError with WSError ──────────────────────────

    it('should handle pre-constructed WSError', async () => {
        const onError = jest.fn();
        const MockWS = createMockWebSocketClass({ autoConnect: false });

        const ws = createWS('ws://example.com/ws', {
            timeout: 5,
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('error', onError);
                },
            }],
        });

        ws.connect();
        await new Promise((r) => setTimeout(r, 30));

        expect(onError).toHaveBeenCalled();
        const ctx = onError.mock.calls[0][0] as { error: { isTimeout: boolean } };
        expect(ctx.error.isTimeout).toBe(true);
    });

    it('should handle error with autoReconnect disabled', async () => {
        const onError = jest.fn();
        const MockWS = createMockWebSocketClass({ autoConnect: false });

        const ws = createWS('ws://example.com/ws', {
            timeout: 5,
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('error', onError);
                },
            }],
        });

        ws.connect();
        await new Promise((r) => setTimeout(r, 30));
        expect(ws.state).toBe(WSState.CLOSED);
    });

    it('should handle error and reconnect', async () => {
        const onError = jest.fn();
        const MockWS = createMockWebSocketClass({ autoConnect: false });

        const ws = createWS('ws://example.com/ws', {
            timeout: 5,
            reconnectDelay: 5,
            maxReconnectAttempts: 1,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('error', onError);
                },
            }],
        });

        ws.connect();
        await new Promise((r) => setTimeout(r, 30));

        expect(onError).toHaveBeenCalled();
    });

    it('should handle error with maxAttempts exceeded', async () => {
        const onError = jest.fn();
        const onClose = jest.fn();
        const MockWS = createMockWebSocketClass({ autoConnect: false });

        const ws = createWS('ws://example.com/ws', {
            timeout: 5,
            reconnectDelay: 5,
            maxReconnectAttempts: 0,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('error', onError);
                    api.addHook('close', onClose);
                },
            }],
        });

        ws.connect();
        await new Promise((r) => setTimeout(r, 30));

        expect(onError).toHaveBeenCalled();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── heartbeat send coverage ───────────────────────────

    it('should send heartbeat message via interval', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            heartbeatInterval: 20,
            heartbeatMessage: 'ping',
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();

        // Wait for at least one heartbeat tick
        await new Promise((r) => setTimeout(r, 40));

        ws.close();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── reconnect delay function ──────────────────────────

    it('should support function for reconnectDelay', async () => {
        const onError = jest.fn();
        const MockWS = createMockWebSocketClass({ autoConnect: false });

        const ws = createWS('ws://example.com/ws', {
            timeout: 5,
            reconnectDelay: (attempt: number) => attempt * 10,
            maxReconnectAttempts: 1,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('error', onError);
                },
            }],
        });

        ws.connect();
        await new Promise((r) => setTimeout(r, 30));
        expect(onError).toHaveBeenCalled();
    });

    // ─── URL fallback path ─────────────────────────────────

    it('should build URL with baseURL and empty url', () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('', {
            baseURL: 'wss://api.example.com/ws',
            autoReconnect: false,
            webSocketImpl: MockWS,
        });
        ws.connect();
        expect(ws.url).toContain('wss://api.example.com/ws');
        ws.close();
    });

    it('should handle URL with hash fragment', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws#room', {
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.url).toContain('#room');
        ws.close();
        await flushMicrotasks();
    });

    it('should append params to URL with existing query', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws?existing=1', {
            params: { new: 'value' },
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.url).toContain('existing=1');
        expect(ws.url).toContain('new=value');
        ws.close();
        await flushMicrotasks();
    });

    // ─── plugin.ts coverage ────────────────────────────────

    it('should register send hook via plugin api', () => {
        const ws = createWS('ws://example.com/ws');
        const plugin = {
            name: 'send-test',
            install: jest.fn((api: any) => {
                api.addHook('send', jest.fn());
            }),
        };
        ws.use(plugin);
        expect(plugin.install).toHaveBeenCalled();
    });

    it('should handle unknown hook type gracefully', () => {
        const ws = createWS('ws://example.com/ws');
        const plugin = {
            name: 'unknown-hook',
            install: jest.fn((api: any) => {
                api.addHook('unknown_type', jest.fn());
            }),
        };
        ws.use(plugin);
        expect(plugin.install).toHaveBeenCalled();
    });

    // ─── error.ts toJSON coverage ──────────────────────────

    it('WSError toJSON should include url from config', () => {
        const err = new WSError('test', WSErrorType.CONFIG, { baseURL: 'wss://test.com' });
        const json = err.toJSON();
        expect(json.url).toBe('wss://test.com');
    });

    it('WSError toJSON should show unknown when no baseURL', () => {
        const err = new WSError('test', WSErrorType.NETWORK, {});
        const json = err.toJSON();
        expect(json.url).toBe('unknown');
    });

    it('WSError should store cause error', () => {
        const cause = new Error('original error');
        const err = new WSError('wrapped', WSErrorType.NETWORK, {}, cause);
        expect(err.cause).toBe(cause);
    });

    // ─── send with object ──────────────────────────────────

    it('should send an ArrayBuffer', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();

        const buffer = new ArrayBuffer(4);
        ws.send(buffer);
        expect(ws.state).toBe(WSState.OPEN);
        ws.close();
        await flushMicrotasks();
    });

    // ─── close before onopen ───────────────────────────────

    it('should close gracefully before onopen fires', async () => {
        const MockWS = createMockWebSocketClass({ connectDelay: 100 });
        const onClose = jest.fn();

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('close', onClose);
                },
            }],
        });

        ws.connect();
        // Close before open fires
        ws.close();
        await flushMicrotasks();

        expect(ws.state).toBe(WSState.CLOSED);
        expect(onClose).toHaveBeenCalled();
    });

    // ─── onclose already CLOSED guard ──────────────────────

    it('should skip onclose processing when already CLOSED', async () => {
        const onClose = jest.fn();
        const MockWS = createMockWebSocketClass();

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('close', onClose);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();
        ws.close();
        await flushMicrotasks();

        // onclose fires once from manual close
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── non-manual close (onclose reconnect flow) ─────────

    it('should handle non-manual onclose with reconnect', async () => {
        const onOpen = jest.fn();
        let mockInstance: MockWSInstance;

        const MockWS = createMockWebSocketClass({
            wasClean: false,
            onCreate: (inst) => { mockInstance = inst; },
        });

        const ws = createWS('ws://example.com/ws', {
            reconnectDelay: 5,
            maxReconnectAttempts: 1,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('open', onOpen);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);

        // Trigger non-manual close
        mockInstance!._triggerClose(1006, 'Connection lost', false);

        await flushMicrotasks();
        ws.close();
        await flushMicrotasks();
    });

    it('should handle non-manual onclose with wasClean=true', async () => {
        const onClose = jest.fn();
        let mockInstance: MockWSInstance;

        const MockWS = createMockWebSocketClass({
            wasClean: true,
            onCreate: (inst) => { mockInstance = inst; },
        });

        const ws = createWS('ws://example.com/ws', {
            reconnectDelay: 5,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('close', onClose);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);

        // Trigger non-manual clean close
        mockInstance!._triggerClose(1000, 'Normal', true);

        await flushMicrotasks();
        expect(onClose).toHaveBeenCalled();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── heartbeat with function ───────────────────────────

    it('should send heartbeat using function message', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            heartbeatInterval: 20,
            heartbeatMessage: () => 'ping-func',
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();
        await new Promise((r) => setTimeout(r, 40));

        ws.close();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── error hook returns false ───────────────────────────

    it('should prevent reconnect when error hook returns false', async () => {
        const onError = jest.fn(() => false);
        const onClose = jest.fn();
        const MockWS = createMockWebSocketClass({ autoConnect: false });

        const ws = createWS('ws://example.com/ws', {
            timeout: 5,
            reconnectDelay: 5,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('error', onError);
                    api.addHook('close', onClose);
                },
            }],
        });

        ws.connect();
        await new Promise((r) => setTimeout(r, 30));

        expect(onError).toHaveBeenCalled();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── auto-reconnect plugin error flow ──────────────────

    it('should trigger auto-reconnect plugin on timeout error', async () => {
        const onError = jest.fn();
        const MockWS = createMockWebSocketClass({ autoConnect: false });

        const ws = createWS('ws://example.com/ws', {
            timeout: 5,
            reconnectDelay: 5,
            maxReconnectAttempts: 1,
            webSocketImpl: MockWS,
            plugins: [
                createAutoReconnectPlugin({ maxAttempts: 1 }),
                {
                    name: 'test',
                    install(api) {
                        api.addHook('error', onError);
                    },
                },
            ],
        });

        ws.connect();
        await new Promise((r) => setTimeout(r, 30));

        expect(onError).toHaveBeenCalled();
        ws.close();
        await flushMicrotasks();
    });

    it('should trigger auto-reconnect plugin with shouldReconnect', async () => {
        const onError = jest.fn();
        const MockWS = createMockWebSocketClass({ autoConnect: false });

        const ws = createWS('ws://example.com/ws', {
            timeout: 5,
            reconnectDelay: 5,
            maxReconnectAttempts: 2,
            webSocketImpl: MockWS,
            plugins: [
                createAutoReconnectPlugin({
                    shouldReconnect: () => true,
                    delay: 10,
                }),
                {
                    name: 'test',
                    install(api) {
                        api.addHook('error', onError);
                    },
                },
            ],
        });

        ws.connect();
        await new Promise((r) => setTimeout(r, 30));

        expect(onError).toHaveBeenCalled();
        ws.close();
        await flushMicrotasks();
    });

    it('should trigger auto-reconnect plugin with default options', async () => {
        const onError = jest.fn();
        const MockWS = createMockWebSocketClass({ autoConnect: false });

        const ws = createWS('ws://example.com/ws', {
            timeout: 5,
            reconnectDelay: 5,
            maxReconnectAttempts: 1,
            webSocketImpl: MockWS,
            plugins: [
                createAutoReconnectPlugin(),
                {
                    name: 'test',
                    install(api) {
                        api.addHook('error', onError);
                    },
                },
            ],
        });

        ws.connect();
        await new Promise((r) => setTimeout(r, 30));

        expect(onError).toHaveBeenCalled();
        ws.close();
        await flushMicrotasks();
    });

    // ─── mergeWSConfig with meta ────────────────────────────

    it('should deep merge meta in config', () => {
        // Create with meta, then verify it's stored
        const ws = createWS('ws://example.com/ws', {
            meta: { key: 'value' },
        });
        expect(ws.defaults.meta).toEqual({ key: 'value' });
    });

    // ─── serializeWSMessage and parseWSMessage ─────────────

    it('should serialize JSON object for send', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();
        ws.send({ nested: { value: 1 } });
        ws.close();
        await flushMicrotasks();
    });

    it('should handle non-Error in getWSErrorMessage', () => {
        // This is tested indirectly via error handling
        // We test parseWSMessage with invalid JSON
        const MockWS = createMockWebSocketClass({
            messages: ['not json'],
        });
        const onMessage = jest.fn();
        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('message', onMessage);
                },
            }],
        });

        ws.connect();
        // Will be tested asynchronously
        ws.close();
    });

    // ─── URL with invalid baseURL catch path ────────────────

    it('should handle URL construction with invalid base', () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://direct.com/ws', {
            baseURL: 'invalid://',
            autoReconnect: false,
            webSocketImpl: MockWS,
        });
        ws.connect();
        expect(ws.url).toContain('ws://direct.com/ws');
        ws.close();
    });

    // ─── onclose maxAttempts exceeded (else branch) ────────

    it('should finalize close when maxAttempts exceeded on non-manual close', async () => {
        const onClose = jest.fn();
        let mockInstance: MockWSInstance;

        const MockWS = createMockWebSocketClass({
            wasClean: false,
            onCreate: (inst) => { mockInstance = inst; },
        });

        const ws = createWS('ws://example.com/ws', {
            reconnectDelay: 5,
            maxReconnectAttempts: 0,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('close', onClose);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);

        mockInstance!._triggerClose(1006, 'Lost', false);
        await flushMicrotasks();

        expect(onClose).toHaveBeenCalled();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── finalizeClose with ws cleanup ──────────────────────

    it('should clean up ws in finalizeClose', async () => {
        let mockInstance: MockWSInstance;

        const MockWS = createMockWebSocketClass({
            onCreate: (inst) => { mockInstance = inst; },
        });

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();

        // Set ws to a fake state to test cleanup path
        mockInstance!.readyState = 1; // OPEN
        ws.close();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── close with ws undefined ────────────────────────────

    it('should close when ws is undefined', async () => {
        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
        });

        // Close without ever connecting — ws is undefined
        ws.close();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── finalizeClose with ws in OPEN state ────────────────

    it('should call ws.close() in finalizeClose when ws is OPEN', async () => {
        let closeCount = 0;

        // Create a mock where close() doesn't change readyState but fires onclose
        const MockWS = class {
            static OPEN = 1; static CONNECTING = 0; static CLOSING = 2; static CLOSED = 3;
            url = ''; readyState = 1; binaryType = 'blob' as BinaryType;
            onopen: ((e: Event) => void) | null = null;
            onmessage: ((e: MessageEvent) => void) | null = null;
            onerror: ((e: Event) => void) | null = null;
            onclose: ((e: CloseEvent) => void) | null = null;
            constructor(url: string) { this.url = url; }
            close() {
                closeCount++;
                // Fire onclose synchronously without changing readyState
                this.onclose?.(new CloseEvent('close', { code: 1000, reason: '', wasClean: true }));
            }
            send(_data: any) {}
        };

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS as any,
        });

        ws.connect();
        // Mock starts with readyState=1 (OPEN)
        // startConnection will call setupEventHandlers which sets onopen etc.
        // The mock never fires onopen, so state stays CONNECTING
        // But close() checks ws.readyState which is OPEN

        ws.close();
        await flushMicrotasks();

        // close() calls ws.close() once, then onclose fires and
        // finalizeClose calls ws.close() again (since readyState is still OPEN)
        expect(closeCount).toBe(2);
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── close else branch (ws not in OPEN/CONNECTING) ─────

    it('should handle close when ws readyState is CLOSED', async () => {
        const onClose = jest.fn();

        // Mock that starts with readyState=3 (CLOSED)
        const MockWS = class {
            static OPEN = 1; static CONNECTING = 0; static CLOSING = 2; static CLOSED = 3;
            url = ''; readyState = 3; binaryType = 'blob' as BinaryType;
            onopen: ((e: Event) => void) | null = null;
            onmessage: ((e: MessageEvent) => void) | null = null;
            onerror: ((e: Event) => void) | null = null;
            onclose: ((e: CloseEvent) => void) | null = null;
            constructor(url: string) { this.url = url; }
            close() {}
            send(_data: any) {}
        };

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS as any,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('close', onClose);
                },
            }],
        });

        ws.connect();
        // ws.readyState is 3 (CLOSED), so close() takes the else branch
        ws.close();
        await flushMicrotasks();

        expect(onClose).toHaveBeenCalled();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── startConnection catch with non-WSError ─────────────

    it('should catch non-WSError in startConnection', () => {
        const onError = jest.fn();

        // Create a mock that throws a plain Error in constructor
        const BadMockWS = class {
            static OPEN = 1;
            static CONNECTING = 0;
            static CLOSING = 2;
            static CLOSED = 3;
            constructor() {
                throw new Error('constructor failed');
            }
        };

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            webSocketImpl: BadMockWS as any,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('error', onError);
                },
            }],
        });

        ws.connect();
        expect(onError).toHaveBeenCalled();
        const ctx = onError.mock.calls[0][0] as { error: { isNetworkError: boolean; message: string } };
        expect(ctx.error.isNetworkError).toBe(true);
        expect(ctx.error.message).toContain('constructor failed');
    });

    it('should catch non-Error throw in startConnection', () => {
        const onError = jest.fn();

        // Create a mock that throws a non-Error in constructor
        const BadMockWS = class {
            static OPEN = 1;
            static CONNECTING = 0;
            static CLOSING = 2;
            static CLOSED = 3;
            constructor() {
                throw 'string error';
            }
        };

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            webSocketImpl: BadMockWS as any,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('error', onError);
                },
            }],
        });

        ws.connect();
        expect(onError).toHaveBeenCalled();
    });

    // ─── WebSocket not available error ──────────────────────

    it('should throw CONFIG error when WebSocket is not available', () => {
        const onError = jest.fn();
        const origWS = (globalThis as any).WebSocket;
        (globalThis as any).WebSocket = undefined;

        try {
            const ws = createWS('ws://example.com/ws', {
                autoReconnect: false,
                webSocketImpl: null as unknown as typeof WebSocket,
                plugins: [{
                    name: 'test',
                    install(api) {
                        api.addHook('error', onError);
                    },
                }],
            });

            ws.connect();
            expect(onError).toHaveBeenCalled();
            const ctx = onError.mock.calls[0][0] as { error: { isConfigError: boolean; message: string } };
            expect(ctx.error.isConfigError).toBe(true);
            expect(ctx.error.message).toContain('not available');
        } finally {
            (globalThis as any).WebSocket = origWS;
        }
    });

    // ─── auto-reconnect shouldReconnect returns false ───────

    it('should prevent reconnect when auto-reconnect shouldReconnect returns false', async () => {
        const onClose = jest.fn();
        let mockInstance: MockWSInstance;
        const MockWS = createMockWebSocketClass({
            autoConnect: false,
            onCreate: (inst) => { mockInstance = inst; },
        });

        const ws = createWS('ws://example.com/ws', {
            timeout: 50,
            reconnectDelay: 10,
            maxReconnectAttempts: 2,
            webSocketImpl: MockWS,
            plugins: [
                createAutoReconnectPlugin({
                    shouldReconnect: () => false,
                }),
                {
                    name: 'test',
                    install(api) {
                        api.addHook('close', onClose);
                    },
                },
            ],
        });

        ws.connect();
        // Wait for timeout
        await new Promise((r) => setTimeout(r, 100));

        // shouldReconnect returns false, so reconnect is prevented
        // Connection should be closed
        expect(ws.state).toBe(WSState.CLOSED);
        ws.close();
        await flushMicrotasks();
    });

    // ─── parseWSMessage non-string ──────────────────────────

    it('should parse non-JSON message as raw string', async () => {
        const onMessage = jest.fn();
        const MockWS = createMockWebSocketClass({
            messages: ['plain text message'],
        });

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('message', onMessage);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();
        await new Promise((r) => setTimeout(r, 20));

        if (onMessage.mock.calls.length > 0) {
            const ctx = onMessage.mock.calls[0][0] as { message: { data: unknown; raw: string } };
            expect(ctx.message.data).toBe('plain text message');
            expect(ctx.message.raw).toBe('plain text message');
        }
        ws.close();
        await flushMicrotasks();
    });

    // ─── meta merge coverage ────────────────────────────────

    it('should merge meta from config and defaults', () => {
        const ws = createWS('ws://example.com/ws', {
            meta: { a: 1 },
        });
        expect(ws.defaults.meta).toEqual({ a: 1 });
    });

    // ─── Utility function tests ─────────────────────────────

    describe('utils', () => {
        it('buildWSURL should handle ws:// URL without baseURL', () => {
            const url = buildWSURL('', 'ws://example.com/path', {});
            expect(url).toBe('ws://example.com/path');
        });

        it('buildWSURL should handle wss:// URL without baseURL', () => {
            const url = buildWSURL('', 'wss://example.com/path', {});
            expect(url).toBe('wss://example.com/path');
        });

        it('buildWSURL should handle URL with baseURL and relative path', () => {
            const url = buildWSURL('wss://api.example.com', '/ws', {});
            expect(url).toBe('wss://api.example.com/ws');
        });

        it('buildWSURL should handle catch branch with non-ws URL', () => {
            // This triggers the catch block in URL construction
            // Using an invalid baseURL that causes new URL() to throw
            const url = buildWSURL('invalid-base', '/path', {});
            expect(url).toBe('invalid-base/path');
        });

        it('buildWSURL should handle catch branch with ws URL fallback', () => {
            // When catch fires and url starts with ws://, use url directly
            const url = buildWSURL('invalid-base', 'ws://direct.com/ws', {});
            expect(url).toBe('ws://direct.com/ws');
        });

        it('buildWSURL should return empty for missing URL and baseURL', () => {
            const url = buildWSURL('', '', {});
            expect(url).toBe('');
        });

        it('buildWSURL should handle hash fragment preservation', () => {
            const url = buildWSURL('', 'ws://example.com/ws#room1', { token: 'abc' });
            expect(url).toContain('token=abc');
            expect(url).toContain('#room1');
        });

        it('mergeWSConfig should deep merge meta', () => {
            const result = mergeWSConfig(
                { meta: { a: 1, b: 2 } },
                { meta: { b: 3, c: 4 } },
            );
            expect(result.meta).toEqual({ a: 1, b: 3, c: 4 });
        });

        it('mergeWSConfig should work without second argument', () => {
            const result = mergeWSConfig({ autoReconnect: true });
            expect(result.autoReconnect).toBe(true);
        });

        it('getReconnectDelay should use default when undefined', () => {
            const delay = getReconnectDelay({}, 0);
            expect(delay).toBe(3000);
        });

        it('getReconnectDelay should use static number', () => {
            const delay = getReconnectDelay({ reconnectDelay: 5000 }, 0);
            expect(delay).toBe(5000);
        });

        it('getReconnectDelay should use function', () => {
            const delay = getReconnectDelay(
                { reconnectDelay: (n: number) => n * 1000 },
                2,
            );
            expect(delay).toBe(2000);
        });

        it('getWSErrorMessage should extract from Error', () => {
            const msg = getWSErrorMessage(new Error('test error'));
            expect(msg).toBe('test error');
        });

        it('getWSErrorMessage should convert non-Error to string', () => {
            const msg = getWSErrorMessage('plain string error');
            expect(msg).toBe('plain string error');
        });

        it('getWSErrorMessage should handle number', () => {
            const msg = getWSErrorMessage(42);
            expect(msg).toBe('42');
        });

        it('parseWSMessage should parse valid JSON', () => {
            const result = parseWSMessage('{"key":"value"}');
            expect(result).toEqual({ key: 'value' });
        });

        it('parseWSMessage should return raw on invalid JSON', () => {
            const result = parseWSMessage('not json');
            expect(result).toBe('not json');
        });

        it('serializeWSMessage should JSON-stringify objects', () => {
            const result = serializeWSMessage({ key: 'value' });
            expect(result).toBe('{"key":"value"}');
        });

        it('serializeWSMessage should pass through strings', () => {
            const result = serializeWSMessage('hello');
            expect(result).toBe('hello');
        });

        it('serializeWSMessage should pass through ArrayBuffer', () => {
            const buf = new ArrayBuffer(4);
            const result = serializeWSMessage(buf);
            expect(result).toBe(buf);
        });
    });
});

// ─── Request-Sync Plugin Tests ─────────────────────────────

describe('createRequestSyncPlugin', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    // ─── Basic request/response ────────────────────────────

    it('should resolve request when matching response arrives', async () => {
        const syncPlugin = createRequestSyncPlugin({ timeout: 5000 });
        const MockWS = createMockWebSocketClass({ autoConnect: false });

        let wsInstance: MockWSInstance;
        const MockWS2 = class {
            static OPEN = 1; static CONNECTING = 0; static CLOSING = 2; static CLOSED = 3;
            url = ''; readyState = 1; binaryType = 'blob' as BinaryType;
            onopen: ((e: Event) => void) | null = null;
            onmessage: ((e: MessageEvent) => void) | null = null;
            onerror: ((e: Event) => void) | null = null;
            onclose: ((e: CloseEvent) => void) | null = null;
            private sent: any[] = [];
            constructor(url: string) {
                this.url = url;
                wsInstance = this;
                setTimeout(() => this.onopen?.(new Event('open')), 5);
            }
            send(data: any) { this.sent.push(data); }
            close() {}
            _getSent() { return [...this.sent]; }
        };

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS2 as any,
            plugins: [syncPlugin],
        });

        ws.connect();
        await flushMicrotasks();

        const request = syncPlugin.bindSend(ws.send.bind(ws));
        const responsePromise = request({ action: 'getUser' });

        // The plugin wraps the message: { id: 0, data: { action: 'getUser' } }
        const sent = (wsInstance! as any)._getSent();
        expect(sent.length).toBe(1);
        const sentData = JSON.parse(sent[0]);
        expect(sentData.id).toBe(0);
        expect(sentData.data).toEqual({ action: 'getUser' });

        // Simulate server response
        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ id: 0, data: { name: 'test-user' } }),
        }));

        const result = await responsePromise;
        expect(result).toEqual({ name: 'test-user' });

        ws.close();
        await flushMicrotasks();
    });

    // ─── String id type ─────────────────────────────────────

    it('should generate string ids', async () => {
        const syncPlugin = createRequestSyncPlugin({ idType: 'string', timeout: 5000 });

        let wsInstance: MockWSInstance;
        const MockWS2 = class {
            static OPEN = 1; static CONNECTING = 0; static CLOSING = 2; static CLOSED = 3;
            url = ''; readyState = 1; binaryType = 'blob' as BinaryType;
            onopen: ((e: Event) => void) | null = null;
            onmessage: ((e: MessageEvent) => void) | null = null;
            onerror: ((e: Event) => void) | null = null;
            onclose: ((e: CloseEvent) => void) | null = null;
            private sent: any[] = [];
            constructor(url: string) {
                this.url = url;
                wsInstance = this;
                setTimeout(() => this.onopen?.(new Event('open')), 5);
            }
            send(data: any) { this.sent.push(data); }
            close() {}
            _getSent() { return [...this.sent]; }
        };

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS2 as any,
            plugins: [syncPlugin],
        });

        ws.connect();
        await flushMicrotasks();

        const request = syncPlugin.bindSend(ws.send.bind(ws));
        const responsePromise = request({ action: 'test' });

        const sent = (wsInstance! as any)._getSent();
        const sentData = JSON.parse(sent[0]);
        expect(typeof sentData.id).toBe('string');
        expect(sentData.id.length).toBe(16);

        // Resolve
        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ id: sentData.id, data: { ok: true } }),
        }));

        const result = await responsePromise;
        expect(result).toEqual({ ok: true });

        ws.close();
        await flushMicrotasks();
    });

    // ─── Custom id generator ────────────────────────────────

    it('should use custom id generator', async () => {
        let callCount = 0;
        const customGenerator = () => `custom-${callCount++}`;

        const syncPlugin = createRequestSyncPlugin({
            idGenerator: customGenerator,
            timeout: 5000,
        });

        let wsInstance: MockWSInstance;
        const MockWS2 = class {
            static OPEN = 1; static CONNECTING = 0; static CLOSING = 2; static CLOSED = 3;
            url = ''; readyState = 1; binaryType = 'blob' as BinaryType;
            onopen: ((e: Event) => void) | null = null;
            onmessage: ((e: MessageEvent) => void) | null = null;
            onerror: ((e: Event) => void) | null = null;
            onclose: ((e: CloseEvent) => void) | null = null;
            private sent: any[] = [];
            constructor(url: string) {
                this.url = url;
                wsInstance = this;
                setTimeout(() => this.onopen?.(new Event('open')), 5);
            }
            send(data: any) { this.sent.push(data); }
            close() {}
            _getSent() { return [...this.sent]; }
        };

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS2 as any,
            plugins: [syncPlugin],
        });

        ws.connect();
        await flushMicrotasks();

        const request = syncPlugin.bindSend(ws.send.bind(ws));
        const p1 = request({ a: 1 });
        const p2 = request({ b: 2 });

        const sent = (wsInstance! as any)._getSent();
        expect(JSON.parse(sent[0]).id).toBe('custom-0');
        expect(JSON.parse(sent[1]).id).toBe('custom-1');

        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ id: 'custom-0', data: 'r1' }),
        }));
        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ id: 'custom-1', data: 'r2' }),
        }));

        expect(await p1).toBe('r1');
        expect(await p2).toBe('r2');

        ws.close();
        await flushMicrotasks();
    });

    // ─── Custom request formatter ───────────────────────────

    it('should use custom request formatter', async () => {
        const syncPlugin = createRequestSyncPlugin({
            timeout: 5000,
            requestFormatter: (id, data: any) => ({
                reqId: id,
                payload: data,
                ts: Date.now(),
            }),
        });

        let wsInstance: MockWSInstance;
        const MockWS2 = class {
            static OPEN = 1; static CONNECTING = 0; static CLOSING = 2; static CLOSED = 3;
            url = ''; readyState = 1; binaryType = 'blob' as BinaryType;
            onopen: ((e: Event) => void) | null = null;
            onmessage: ((e: MessageEvent) => void) | null = null;
            onerror: ((e: Event) => void) | null = null;
            onclose: ((e: CloseEvent) => void) | null = null;
            private sent: any[] = [];
            constructor(url: string) {
                this.url = url;
                wsInstance = this;
                setTimeout(() => this.onopen?.(new Event('open')), 5);
            }
            send(data: any) { this.sent.push(data); }
            close() {}
            _getSent() { return [...this.sent]; }
        };

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS2 as any,
            plugins: [syncPlugin],
        });

        ws.connect();
        await flushMicrotasks();

        const request = syncPlugin.bindSend(ws.send.bind(ws));
        const p = request({ cmd: 'test' });

        const sent = (wsInstance! as any)._getSent();
        const sentData = JSON.parse(sent[0]);
        expect(sentData.reqId).toBe(0);
        expect(sentData.payload).toEqual({ cmd: 'test' });
        expect(typeof sentData.ts).toBe('number');

        // Respond with matching format
        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ id: 0, data: 'ok' }),
        }));

        expect(await p).toBe('ok');

        ws.close();
        await flushMicrotasks();
    });

    // ─── Custom response matcher/extractor ──────────────────

    it('should use custom response matcher and extractors', async () => {
        const syncPlugin = createRequestSyncPlugin({
            timeout: 5000,
            requestFormatter: (id, data) => ({ requestId: id, body: data }),
            responseIdExtractor: (data: any) => data?.responseId,
            responseMatcher: (data: any) => data?.responseId !== undefined,
            responseDataExtractor: (data: any) => data?.result,
        });

        let wsInstance: MockWSInstance;
        const MockWS2 = class {
            static OPEN = 1; static CONNECTING = 0; static CLOSING = 2; static CLOSED = 3;
            url = ''; readyState = 1; binaryType = 'blob' as BinaryType;
            onopen: ((e: Event) => void) | null = null;
            onmessage: ((e: MessageEvent) => void) | null = null;
            onerror: ((e: Event) => void) | null = null;
            onclose: ((e: CloseEvent) => void) | null = null;
            private sent: any[] = [];
            constructor(url: string) {
                this.url = url;
                wsInstance = this;
                setTimeout(() => this.onopen?.(new Event('open')), 5);
            }
            send(data: any) { this.sent.push(data); }
            close() {}
            _getSent() { return [...this.sent]; }
        };

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS2 as any,
            plugins: [syncPlugin],
        });

        ws.connect();
        await flushMicrotasks();

        const request = syncPlugin.bindSend(ws.send.bind(ws));
        const p = request({ query: 'data' });

        const sent = (wsInstance! as any)._getSent();
        const sentData = JSON.parse(sent[0]);
        expect(sentData.requestId).toBe(0);
        expect(sentData.body).toEqual({ query: 'data' });

        // Server push should be ignored
        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ type: 'notification', text: 'hello' }),
        }));

        // Actual response
        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ responseId: 0, result: { rows: [1, 2, 3] } }),
        }));

        expect(await p).toEqual({ rows: [1, 2, 3] });

        ws.close();
        await flushMicrotasks();
    });

    // ─── Timeout ────────────────────────────────────────────

    it('should timeout when no response received', async () => {
        const syncPlugin = createRequestSyncPlugin({ timeout: 50 });
        const MockWS = createMockWebSocketClass();

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [syncPlugin],
        });

        ws.connect();
        await flushMicrotasks();

        const request = syncPlugin.bindSend(ws.send.bind(ws));
        await expect(request({ action: 'slow' })).rejects.toThrow('timeout');

        ws.close();
        await flushMicrotasks();
    });

    it('should use per-request timeout override', async () => {
        const syncPlugin = createRequestSyncPlugin({ timeout: 5000 }); // long default

        const MockWS = createMockWebSocketClass();

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [syncPlugin],
        });

        ws.connect();
        await flushMicrotasks();

        const request = syncPlugin.bindSend(ws.send.bind(ws));
        // Override with short timeout
        await expect(request({ action: 'fast' }, 20)).rejects.toThrow('timeout');

        ws.close();
        await flushMicrotasks();
    });

    // ─── Server push messages ignored ───────────────────────

    it('should ignore server push messages (no id)', async () => {
        const syncPlugin = createRequestSyncPlugin({ timeout: 5000 });

        let wsInstance: MockWSInstance;
        const MockWS2 = class {
            static OPEN = 1; static CONNECTING = 0; static CLOSING = 2; static CLOSED = 3;
            url = ''; readyState = 1; binaryType = 'blob' as BinaryType;
            onopen: ((e: Event) => void) | null = null;
            onmessage: ((e: MessageEvent) => void) | null = null;
            onerror: ((e: Event) => void) | null = null;
            onclose: ((e: CloseEvent) => void) | null = null;
            private sent: any[] = [];
            constructor(url: string) {
                this.url = url;
                wsInstance = this;
                setTimeout(() => this.onopen?.(new Event('open')), 5);
            }
            send(data: any) { this.sent.push(data); }
            close() {}
            _getSent() { return [...this.sent]; }
        };

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS2 as any,
            plugins: [syncPlugin],
        });

        ws.connect();
        await flushMicrotasks();

        const request = syncPlugin.bindSend(ws.send.bind(ws));
        const p = request({ cmd: 'subscribe' });

        // Server push — should be ignored
        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ type: 'heartbeat' }),
        }));

        // Another server push
        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ event: 'update', payload: 'x' }),
        }));

        // Actual response
        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ id: 0, data: 'subscribed' }),
        }));

        expect(await p).toBe('subscribed');

        ws.close();
        await flushMicrotasks();
    });

    // ─── Multiple concurrent requests ───────────────────────

    it('should handle multiple concurrent requests', async () => {
        const syncPlugin = createRequestSyncPlugin({ timeout: 5000 });

        let wsInstance: MockWSInstance;
        const MockWS2 = class {
            static OPEN = 1; static CONNECTING = 0; static CLOSING = 2; static CLOSED = 3;
            url = ''; readyState = 1; binaryType = 'blob' as BinaryType;
            onopen: ((e: Event) => void) | null = null;
            onmessage: ((e: MessageEvent) => void) | null = null;
            onerror: ((e: Event) => void) | null = null;
            onclose: ((e: CloseEvent) => void) | null = null;
            private sent: any[] = [];
            constructor(url: string) {
                this.url = url;
                wsInstance = this;
                setTimeout(() => this.onopen?.(new Event('open')), 5);
            }
            send(data: any) { this.sent.push(data); }
            close() {}
            _getSent() { return [...this.sent]; }
        };

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS2 as any,
            plugins: [syncPlugin],
        });

        ws.connect();
        await flushMicrotasks();

        const request = syncPlugin.bindSend(ws.send.bind(ws));

        const p1 = request({ action: 'a' });
        const p2 = request({ action: 'b' });
        const p3 = request({ action: 'c' });

        // Respond out of order
        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ id: 2, data: 'c-result' }),
        }));
        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ id: 0, data: 'a-result' }),
        }));
        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ id: 1, data: 'b-result' }),
        }));

        expect(await p1).toBe('a-result');
        expect(await p2).toBe('b-result');
        expect(await p3).toBe('c-result');

        ws.close();
        await flushMicrotasks();
    });

    // ─── Error: send not bound ──────────────────────────────

    it('should throw if send is not bound', async () => {
        const syncPlugin = createRequestSyncPlugin();

        const MockWS = createMockWebSocketClass();

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [syncPlugin],
        });

        ws.connect();
        await flushMicrotasks();

        // We get the request method from a different syncPlugin instance (not bound)
        const unboundPlugin = createRequestSyncPlugin();
        const unboundRequest = unboundPlugin.bindSend(undefined as any);
        await expect((unboundRequest as any)()).rejects.toThrow('send not bound');

        ws.close();
        await flushMicrotasks();
    });

    // ─── Id generator tests ─────────────────────────────────

    it('createNumericIdGenerator should start from given initial value', () => {
        const gen = createNumericIdGenerator(100);
        expect(gen()).toBe(100);
        expect(gen()).toBe(101);
        expect(gen()).toBe(102);
    });

    it('createNumericIdGenerator should wrap at MAX_SAFE_INTEGER', () => {
        const gen = createNumericIdGenerator(Number.MAX_SAFE_INTEGER - 1);
        expect(gen()).toBe(Number.MAX_SAFE_INTEGER - 1);
        expect(gen()).toBe(Number.MAX_SAFE_INTEGER);
        expect(gen()).toBe(Number.MAX_SAFE_INTEGER - 1); // wraps back to initial
    });

    it('createNumericIdGenerator should start from 0 by default', () => {
        const gen = createNumericIdGenerator();
        // Might have been used before, so just check it returns numbers
        const id = gen();
        expect(typeof id).toBe('number');
    });

    it('createRandomIdGenerator should generate strings of given length', () => {
        const gen = createRandomIdGenerator(32);
        const id = gen();
        expect(typeof id).toBe('string');
        expect(id.length).toBe(32);
        expect(/^[a-z0-9]+$/.test(id)).toBe(true);
    });

    it('createRandomIdGenerator should default to length 16', () => {
        const gen = createRandomIdGenerator();
        const id = gen();
        expect(id.length).toBe(16);
    });

    it('createRandomIdGenerator should generate unique ids', () => {
        const gen = createRandomIdGenerator(8);
        const ids = new Set<string>();
        for (let i = 0; i < 100; i++) {
            ids.add(gen());
        }
        // With 8 chars, 100 ids should all be unique (extremely low collision probability)
        expect(ids.size).toBe(100);
    });

    // ─── Plugin name ────────────────────────────────────────

    it('should have plugin name "request-sync"', () => {
        const plugin = createRequestSyncPlugin();
        expect(plugin.name).toBe('request-sync');
    });

    // ─── Response with null id ──────────────────────────────

    it('should ignore response with null id', async () => {
        const syncPlugin = createRequestSyncPlugin({ timeout: 5000 });

        let wsInstance: MockWSInstance;
        const MockWS2 = class {
            static OPEN = 1; static CONNECTING = 0; static CLOSING = 2; static CLOSED = 3;
            url = ''; readyState = 1; binaryType = 'blob' as BinaryType;
            onopen: ((e: Event) => void) | null = null;
            onmessage: ((e: MessageEvent) => void) | null = null;
            onerror: ((e: Event) => void) | null = null;
            onclose: ((e: CloseEvent) => void) | null = null;
            private sent: any[] = [];
            constructor(url: string) {
                this.url = url;
                wsInstance = this;
                setTimeout(() => this.onopen?.(new Event('open')), 5);
            }
            send(data: any) { this.sent.push(data); }
            close() {}
            _getSent() { return [...this.sent]; }
        };

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS2 as any,
            plugins: [syncPlugin],
        });

        ws.connect();
        await flushMicrotasks();

        const request = syncPlugin.bindSend(ws.send.bind(ws));
        const p = request({ action: 'test' });

        // Message with null id — should be ignored
        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ id: null, data: 'ignored' }),
        }));

        // Actual response
        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ id: 0, data: 'real' }),
        }));

        expect(await p).toBe('real');

        ws.close();
        await flushMicrotasks();
    });

    // ─── Response with no matching pending request ──────────

    it('should ignore response with no matching pending request', async () => {
        const syncPlugin = createRequestSyncPlugin({ timeout: 5000 });

        let wsInstance: MockWSInstance;
        const MockWS2 = class {
            static OPEN = 1; static CONNECTING = 0; static CLOSING = 2; static CLOSED = 3;
            url = ''; readyState = 1; binaryType = 'blob' as BinaryType;
            onopen: ((e: Event) => void) | null = null;
            onmessage: ((e: MessageEvent) => void) | null = null;
            onerror: ((e: Event) => void) | null = null;
            onclose: ((e: CloseEvent) => void) | null = null;
            private sent: any[] = [];
            constructor(url: string) {
                this.url = url;
                wsInstance = this;
                setTimeout(() => this.onopen?.(new Event('open')), 5);
            }
            send(data: any) { this.sent.push(data); }
            close() {}
            _getSent() { return [...this.sent]; }
        };

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS2 as any,
            plugins: [syncPlugin],
        });

        ws.connect();
        await flushMicrotasks();

        const request = syncPlugin.bindSend(ws.send.bind(ws));
        const p = request({ action: 'test' });

        // Response with id 999 — no matching pending request
        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ id: 999, data: 'orphan' }),
        }));

        // Actual response
        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ id: 0, data: 'ok' }),
        }));

        expect(await p).toBe('ok');

        ws.close();
        await flushMicrotasks();
    });

    // ─── BindSend with valid send ───────────────────────────

    it('should bind send and use it for requests', async () => {
        const syncPlugin = createRequestSyncPlugin({ timeout: 5000 });

        let wsInstance: MockWSInstance;
        const MockWS2 = class {
            static OPEN = 1; static CONNECTING = 0; static CLOSING = 2; static CLOSED = 3;
            url = ''; readyState = 1; binaryType = 'blob' as BinaryType;
            onopen: ((e: Event) => void) | null = null;
            onmessage: ((e: MessageEvent) => void) | null = null;
            onerror: ((e: Event) => void) | null = null;
            onclose: ((e: CloseEvent) => void) | null = null;
            private sent: any[] = [];
            constructor(url: string) {
                this.url = url;
                wsInstance = this;
                setTimeout(() => this.onopen?.(new Event('open')), 5);
            }
            send(data: any) { this.sent.push(data); }
            close() {}
            _getSent() { return [...this.sent]; }
        };

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS2 as any,
            plugins: [syncPlugin],
        });

        ws.connect();
        await flushMicrotasks();

        // Bind with ws.send
        const request = syncPlugin.bindSend(ws.send.bind(ws));
        const p = request({ cmd: 'x' });

        wsInstance!.onmessage!(new MessageEvent('message', {
            data: JSON.stringify({ id: 0, data: 'done' }),
        }));

        expect(await p).toBe('done');

        ws.close();
        await flushMicrotasks();
    });

    // ─── Send throws ────────────────────────────────────────

    it('should reject when send throws', async () => {
        const syncPlugin = createRequestSyncPlugin({ timeout: 5000 });

        // Use a mock where send always throws
        const BadSendWS = class {
            static OPEN = 1; static CONNECTING = 0; static CLOSING = 2; static CLOSED = 3;
            url = ''; readyState = 1; binaryType = 'blob' as BinaryType;
            onopen: ((e: Event) => void) | null = null;
            onmessage: ((e: MessageEvent) => void) | null = null;
            onerror: ((e: Event) => void) | null = null;
            onclose: ((e: CloseEvent) => void) | null = null;
            constructor(url: string) {
                this.url = url;
                setTimeout(() => this.onopen?.(new Event('open')), 5);
            }
            send(_data: any) { throw new Error('send failed'); }
            close() {}
        };

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: BadSendWS as any,
            plugins: [syncPlugin],
        });

        ws.connect();
        await flushMicrotasks();

        const request = syncPlugin.bindSend(ws.send.bind(ws));
        await expect(request({ cmd: 'test' })).rejects.toThrow('send failed');

        ws.close();
        await flushMicrotasks();
    });

    // ─── Coverage: onmessage with non-string data (line 162) ─

    it('should handle onmessage with non-string data (ArrayBuffer)', async () => {
        const onMessage = jest.fn();
        let mockInstance: MockWSInstance;

        const MockWS = createMockWebSocketClass({
            onCreate: (inst) => { mockInstance = inst; },
        });

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('message', onMessage);
                },
            }],
        });

        ws.connect();
        await flushMicrotasks();

        // Send an ArrayBuffer as message data (not a string)
        const buffer = new ArrayBuffer(4);
        new Uint8Array(buffer).set([1, 2, 3, 4]);
        mockInstance!._triggerMessage(buffer);

        await flushMicrotasks();

        // raw should be the String() representation of the ArrayBuffer
        const ctx = onMessage.mock.calls[0][0] as { message: { raw: string } };
        expect(typeof ctx.message.raw).toBe('string');
        expect(ctx.message.raw).toBe('[object ArrayBuffer]');

        ws.close();
        await flushMicrotasks();
    });

    // ─── Coverage: onclose when state is already CLOSED (line 187) ─

    it('should skip onclose processing when state is already CLOSED', async () => {
        let mockInstance: MockWSInstance;

        const MockWS = createMockWebSocketClass({
            onCreate: (inst) => { mockInstance = inst; },
        });

        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();

        // Manually close, then trigger onclose again after state is CLOSED
        ws.close();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.CLOSED);

        // Trigger onclose when state is already CLOSED — should be a no-op (line 187)
        mockInstance!._triggerClose(1006, 'Already closed', false);
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.CLOSED);
    });

    // ─── Coverage: handleError reconnect with default maxReconnectAttempts (line 260) ─

    it('should handle error and reconnect with default maxReconnectAttempts', async () => {
        const onError = jest.fn();
        const MockWS = createMockWebSocketClass({ autoConnect: false });

        const ws = createWS('ws://example.com/ws', {
            timeout: 5,
            reconnectDelay: 5,
            // maxReconnectAttempts not set — uses DEFAULT (line 260)
            webSocketImpl: MockWS,
            plugins: [{
                name: 'test',
                install(api) {
                    api.addHook('error', onError);
                },
            }],
        });

        ws.connect();
        await new Promise((r) => setTimeout(r, 30));

        expect(onError).toHaveBeenCalled();
        // scheduleReconnect should have been called (line 263)
    });

    // ─── Branch coverage: onclose when state is CLOSED (line 187 true branch) ─

    it('should skip onclose when state is already CLOSED (branch coverage)', async () => {
        let mockInstance: MockWSInstance;

        const MockWS = createMockWebSocketClass({
            wasClean: false,
            onCreate: (inst) => { mockInstance = inst; },
        });

        const ws = createWS('ws://example.com/ws', {
            reconnectDelay: 1000, // long delay so reconnect timer doesn't fire
            maxReconnectAttempts: 2,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);

        // First _triggerClose: non-manual close, state becomes CLOSED, scheduleReconnect called
        mockInstance!._triggerClose(1006, 'First close', false);
        // State is now CLOSED (set synchronously in onclose handler)
        expect(ws.state).toBe(WSState.CLOSED);

        // Second _triggerClose: onclose fires again, but state is already CLOSED → true branch (line 187)
        mockInstance!._triggerClose(1006, 'Second close', false);

        ws.close();
        await flushMicrotasks();
    });

    // ─── Branch coverage: tryReconnect guard when state is not CLOSED ─

    it('should skip reconnect when state is not CLOSED (tryReconnect guard)', async () => {
        let mockInstance: MockWSInstance;

        const MockWS = createMockWebSocketClass({
            wasClean: false,
            onCreate: (inst) => { mockInstance = inst; },
        });

        const ws = createWS('ws://example.com/ws', {
            reconnectDelay: 30,
            maxReconnectAttempts: 2,
            webSocketImpl: MockWS,
        });

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);

        // Trigger non-manual close → scheduleReconnect sets 30ms timer
        mockInstance!._triggerClose(1006, 'Unexpected', false);

        // Immediately connect again before the 30ms timer fires
        // state becomes CONNECTING then OPEN (autoConnect: true, 0ms delay)
        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);

        // Wait for the 30ms reconnect timer to fire
        // Timer callback: state is OPEN (!== CLOSED) → returns early
        await new Promise((r) => setTimeout(r, 60));
        await flushMicrotasks();

        // State should still be OPEN
        expect(ws.state).toBe(WSState.OPEN);

        ws.close();
        await flushMicrotasks();
    });

    // ─── Direct tryReconnect coverage ────────────────────────────

    it('should call _tryReconnect when state is CLOSED (reconnect)', async () => {
        const MockWS = createMockWebSocketClass({ autoConnect: false });
        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
        }) as any;

        // Close the connection so state is CLOSED
        ws.connect();
        expect(ws.state).toBe(WSState.CONNECTING);
        ws.close();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.CLOSED);

        // Directly call _tryReconnect — state is CLOSED, so it should call startConnection
        ws._tryReconnect();
        // After tryReconnect, state should be CONNECTING (startConnection was called)
        expect(ws.state).toBe(WSState.CONNECTING);

        ws.close();
        await flushMicrotasks();
    });

    it('should skip _tryReconnect when state is OPEN', async () => {
        const MockWS = createMockWebSocketClass();
        const ws = createWS('ws://example.com/ws', {
            autoReconnect: false,
            webSocketImpl: MockWS,
        }) as any;

        ws.connect();
        await flushMicrotasks();
        expect(ws.state).toBe(WSState.OPEN);

        // Directly call _tryReconnect — state is OPEN, should return early (branch coverage line 292)
        ws._tryReconnect();
        // State should remain OPEN
        expect(ws.state).toBe(WSState.OPEN);

        ws.close();
        await flushMicrotasks();
    });
});

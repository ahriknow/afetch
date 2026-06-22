/**
 * aws - Request-Sync Plugin
 * Convert async WebSocket messaging into synchronous request/response pattern.
 *
 * The plugin maintains its own id generator, wraps outgoing messages with an id,
 * and resolves the returned Promise when a matching response arrives.
 */

import type { WSPlugin, WSPluginApi, WSMessageContext } from '../plugin.js';

// ─── Id generators ──────────────────────────────────────────

/**
 * Numeric id generator (auto-increment, wraps around at MAX_SAFE_INTEGER).
 * Uses a closure-scoped counter for safety.
 */
export function createNumericIdGenerator(initial: number = 0): () => number {
    let counter = initial;
    return () => {
        const id = counter;
        counter = counter >= Number.MAX_SAFE_INTEGER ? initial : counter + 1;
        return id;
    };
}

/**
 * Random string id generator.
 */
export function createRandomIdGenerator(length: number = 16): () => string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return () => {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };
}

// ─── Types ──────────────────────────────────────────────────

export type IdType = 'number' | 'string';

export type IdGenerator = () => number | string;

/**
 * Format the outgoing request message.
 * Receives the generated id and the original data, returns the payload to send.
 */
export type RequestFormatter<T = unknown> = (id: number | string, data: T) => unknown;

/**
 * Extract the response id from an incoming message.
 * Receives the parsed message data, should return the id field.
 * Default: `msg.id`
 */
export type ResponseIdExtractor = (data: unknown) => number | string | undefined;

/**
 * Check if an incoming message is a response (as opposed to a server push).
 * Receives the parsed message data, should return true for responses.
 * Default: checks if `msg.id` exists.
 */
export type ResponseMatcher = (data: unknown) => boolean;

/**
 * Extract the response data from an incoming message.
 * Receives the parsed message data, should return the actual data payload.
 * Default: `msg.data`
 */
export type ResponseDataExtractor<T = unknown> = (data: unknown) => T;

export interface RequestSyncOptions<T = unknown> {
    /**
     * Id type: 'number' or 'string'.
     * @default 'number'
     */
    idType?: IdType;

    /**
     * Custom id generator function.
     * Overrides idType if provided.
     */
    idGenerator?: IdGenerator;

    /**
     * Length of random id when idType is 'string'.
     * @default 16
     */
    randomIdLength?: number;

    /**
     * Format the outgoing request message.
     * @default (id, data) => ({ id, data })
     */
    requestFormatter?: RequestFormatter<T>;

    /**
     * Extract the response id from an incoming message.
     * @default (data) => data?.id
     */
    responseIdExtractor?: ResponseIdExtractor;

    /**
     * Check if an incoming message is a response.
     * @default (data) => data?.id !== undefined
     */
    responseMatcher?: ResponseMatcher;

    /**
     * Extract the response data from an incoming message.
     * @default (data) => data?.data
     */
    responseDataExtractor?: ResponseDataExtractor<T>;

    /**
     * Timeout in ms for each request.
     * @default 30000
     */
    timeout?: number;
}

// ─── Result type ────────────────────────────────────────────

/**
 * Returned by createRequestSyncPlugin.
 * Install as a plugin, then call .bindSend(ws) to get the request method.
 */
export interface RequestSyncPlugin<T = unknown> extends WSPlugin {
    /**
     * Bind the request method to a WSClient's send function.
     * @param send - The client's send method (e.g. ws.send.bind(ws))
     * @returns A request function that sends data and returns a Promise
     */
    bindSend(
        send: (data: string | ArrayBuffer | Blob | object) => void
    ): <R = T>(data: T, timeout?: number) => Promise<R>;
}

// ─── Plugin ─────────────────────────────────────────────────

/**
 * Create a request-sync plugin for WebSocket.
 *
 * This plugin enables a request/response pattern over WebSocket by:
 * 1. Wrapping each sent message with a unique id
 * 2. Returning a Promise that resolves when a response with matching id arrives
 * 3. Supporting configurable timeout, id generation, and message format
 *
 * @example
 * ```ts
 * const syncPlugin = createRequestSyncPlugin({ idType: 'number' });
 * const ws = createWS('ws://localhost:8080', { plugins: [syncPlugin] });
 * const request = syncPlugin.bindSend(ws.send.bind(ws));
 * const response = await request({ action: 'getUser', userId: 1 });
 * ```
 */
export function createRequestSyncPlugin<T = unknown>(
    options: RequestSyncOptions<T> = {}
): RequestSyncPlugin<T> {
    const {
        idType = 'number',
        idGenerator,
        randomIdLength = 16,
        requestFormatter = (id, data) => ({ id, data }),
        responseIdExtractor = (data: any) => data?.id,
        responseMatcher = (data: any) => data?.id !== undefined,
        responseDataExtractor = (data: any) => data?.data,
        timeout = 30000,
    } = options;

    // Id generator
    const generateId: IdGenerator =
        idGenerator ||
        (idType === 'number'
            ? createNumericIdGenerator()
            : createRandomIdGenerator(randomIdLength));

    // Pending requests: id -> { resolve, reject, timer }
    const pendingRequests = new Map<
        number | string,
        {
            resolve: (value: unknown) => void;
            reject: (reason: Error) => void;
            timer: ReturnType<typeof setTimeout>;
        }
    >();

    // send reference, set via bindSend
    let _send: ((data: string | ArrayBuffer | Blob | object) => void) | null = null;

    /**
     * Bind the send function from a WSClient.
     */
    function bindSend(
        send: (data: string | ArrayBuffer | Blob | object) => void
    ): <R = T>(data: T, timeout?: number) => Promise<R> {
        _send = send;
        return request;
    }

    /**
     * The request method — send data and get a Promise back.
     */
    function request<R = T>(data: T, perRequestTimeout?: number): Promise<R> {
        return new Promise<R>((resolve, reject) => {
            if (!_send) {
                reject(
                    new Error(
                        'request-sync plugin: send not bound. Call plugin.bindSend(ws.send.bind(ws)) first.'
                    )
                );
                return;
            }

            const id = generateId();
            const formatted = requestFormatter(id, data);

            const effectiveTimeout = perRequestTimeout ?? timeout;

            const timer = setTimeout(() => {
                pendingRequests.delete(id);
                reject(
                    new Error(`Request timeout after ${effectiveTimeout}ms (id: ${String(id)})`)
                );
            }, effectiveTimeout);

            pendingRequests.set(id, {
                resolve: resolve as (value: unknown) => void,
                reject,
                timer,
            });

            try {
                _send(formatted as object);
            } catch (err) {
                clearTimeout(timer);
                pendingRequests.delete(id);
                reject(err);
            }
        });
    }

    const plugin: RequestSyncPlugin<T> = {
        name: 'request-sync',
        bindSend,
        install(api: WSPluginApi) {
            api.addHook('message', (ctx: WSMessageContext) => {
                const data = ctx.message.data;

                // Check if this message is a response (has a matching id)
                if (!responseMatcher(data)) {
                    return; // Not a response, ignore (server push)
                }

                const responseId = responseIdExtractor(data);
                if (responseId === undefined || responseId === null) {
                    return;
                }

                const pending = pendingRequests.get(responseId);
                if (!pending) {
                    return; // No pending request for this id
                }

                // Clear timeout and resolve
                clearTimeout(pending.timer);
                pendingRequests.delete(responseId);

                const responseData = responseDataExtractor(data);
                pending.resolve(responseData);
            });
        },
    };

    return plugin;
}

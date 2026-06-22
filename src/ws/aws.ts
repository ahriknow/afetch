/**
 * aws - WebSocket Core Implementation
 * WebSocket client with plugin system
 */

import type { WSConfig, WSClient } from './types.js';
import { WSState } from './types.js';
import { WSErrorType } from './types.js';
import { WSError } from './error.js';
import { WSHookRunner } from './plugin.js';
import type { WSPlugin, WSPluginApi } from './plugin.js';
import {
    buildWSURL,
    mergeWSConfig,
    getReconnectDelay,
    getWSErrorMessage,
    serializeWSMessage,
    parseWSMessage,
    DEFAULT_WS_CONFIG,
} from './utils.js';

/**
 * Create a WebSocket client instance
 */
export function createWS(url: string, config: WSConfig = {}): WSClient {
    const defaults: WSConfig = { ...config };
    const hooks = new WSHookRunner();
    const installedPlugins = new Set<string>();

    let state: WSState = WSState.CLOSED;
    let fullURL = '';
    let reconnectCount = 0;
    let currentAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    let heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
    let ws: WebSocket | undefined;
    let manualClose = false;

    /**
     * Install a plugin
     */
    function use(plugin: WSPlugin): void {
        if (installedPlugins.has(plugin.name)) return;
        installedPlugins.add(plugin.name);

        const api: WSPluginApi = {
            addHook(type, fn) {
                if (type === 'open') hooks.addOpen(fn as any);
                else if (type === 'message') hooks.addMessage(fn as any);
                else if (type === 'error') hooks.addError(fn as any);
                else if (type === 'close') hooks.addClose(fn as any);
                else if (type === 'send') hooks.addSend(fn as any);
            },
        };

        plugin.install(api);
    }

    // Install plugins from config
    if (defaults.plugins) {
        for (const plugin of defaults.plugins) {
            use(plugin);
        }
    }

    /**
     * Build the merged config and full URL
     */
    function prepareConfig(): { mergedConfig: WSConfig; url: string } {
        const mergedConfig = mergeWSConfig(defaults, config);
        const resolvedURL = buildWSURL(mergedConfig.baseURL || '', url, mergedConfig.params);

        if (!resolvedURL) {
            throw new WSError(
                'URL is required: provide either a url or a baseURL',
                WSErrorType.CONFIG,
                mergedConfig
            );
        }

        return { mergedConfig, url: resolvedURL };
    }

    /**
     * Clear all timers
     */
    function clearTimers(): void {
        if (reconnectTimer !== undefined) {
            clearTimeout(reconnectTimer);
            reconnectTimer = undefined;
        }
        if (timeoutTimer !== undefined) {
            clearTimeout(timeoutTimer);
            timeoutTimer = undefined;
        }
        if (heartbeatTimer !== undefined) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = undefined;
        }
    }

    /**
     * Start heartbeat
     */
    function startHeartbeat(config: WSConfig): void {
        const interval = config.heartbeatInterval ?? DEFAULT_WS_CONFIG.heartbeatInterval;
        if (interval <= 0) return;

        heartbeatTimer = setInterval(() => {
            if (state === WSState.OPEN && ws && ws.readyState === WebSocket.OPEN) {
                const msg = config.heartbeatMessage;
                if (typeof msg === 'function') {
                    ws.send(serializeWSMessage(msg()));
                } else if (msg !== undefined) {
                    ws.send(msg);
                }
            }
        }, interval);
    }

    /**
     * Start connection timeout
     */
    function startTimeout(config: WSConfig): void {
        const timeout = config.timeout ?? DEFAULT_WS_CONFIG.timeout;
        if (timeout <= 0) return;

        timeoutTimer = setTimeout(() => {
            if (state === WSState.CONNECTING) {
                handleError(
                    new WSError(
                        `WebSocket connection timeout after ${timeout}ms`,
                        WSErrorType.TIMEOUT,
                        config
                    )
                );
            }
        }, timeout);
    }

    /**
     * Set up WebSocket event handlers
     */
    function setupEventHandlers(socket: WebSocket, config: WSConfig): void {
        socket.onopen = () => {
            clearTimers(); // clear timeout timer
            state = WSState.OPEN;
            reconnectCount++;
            currentAttempt = 0;
            manualClose = false;

            startHeartbeat(config);

            hooks.runOpen({
                config,
                url: fullURL,
            });
        };

        socket.onmessage = (event: MessageEvent) => {
            const raw = typeof event.data === 'string' ? event.data : String(event.data);

            const data = config.autoParse !== false ? parseWSMessage(raw) : raw;

            const message = {
                data,
                raw,
                origin: event.origin,
                timestamp: Date.now(),
            };

            hooks.runMessage({
                config,
                message,
            });
        };

        socket.onerror = (_event: Event) => {
            // onerror provides no useful info; onclose will follow with details
        };

        socket.onclose = (event: CloseEvent) => {
            clearTimers();

            // If we're already CLOSED (manual close), don't process
            if (state === WSState.CLOSED) return;

            const previousState = state;
            state = WSState.CLOSED;

            // If manual close, finalize
            if (manualClose) {
                finalizeClose(config, event.code, event.reason, event.wasClean);
                return;
            }

            // Run close hooks first
            hooks.runClose({
                config,
                code: event.code,
                reason: event.reason,
                reconnectCount,
                wasClean: event.wasClean,
            });

            // Determine if we should reconnect
            const shouldReconnect =
                config.autoReconnect !== false && previousState === WSState.OPEN && !event.wasClean;

            if (shouldReconnect) {
                const maxAttempts =
                    config.maxReconnectAttempts ?? DEFAULT_WS_CONFIG.maxReconnectAttempts;
                if (currentAttempt < maxAttempts) {
                    void scheduleReconnect(config);
                } else {
                    finalizeClose(config, event.code, event.reason, event.wasClean);
                }
            } else {
                finalizeClose(config, event.code, event.reason, event.wasClean);
            }
        };
    }

    /**
     * Handle an error — run error hooks and decide whether to reconnect
     */
    async function handleError(error: WSError): Promise<void> {
        clearTimers();

        // Close the raw socket if it exists
        if (ws) {
            ws.onclose = null;
            ws.onerror = null;
            ws.onmessage = null;
            ws.onopen = null;
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
            ws = undefined;
        }

        const mergedConfig = mergeWSConfig(defaults, config);

        const preventReconnect = await hooks.runError({
            config: mergedConfig,
            error,
            attempt: currentAttempt,
        });

        if (preventReconnect) {
            state = WSState.CLOSED;
            finalizeClose(mergedConfig, 1006, error.message, false);
            return;
        }

        // Auto-reconnect
        if (mergedConfig.autoReconnect !== false) {
            const maxAttempts =
                mergedConfig.maxReconnectAttempts ?? DEFAULT_WS_CONFIG.maxReconnectAttempts;
            if (currentAttempt < maxAttempts) {
                state = WSState.CLOSED;
                void scheduleReconnect(mergedConfig);
            } else {
                state = WSState.CLOSED;
                finalizeClose(mergedConfig, 1006, error.message, false);
            }
        } else {
            state = WSState.CLOSED;
            finalizeClose(mergedConfig, 1006, error.message, false);
        }
    }

    /**
     * Schedule a reconnection attempt
     */
    async function scheduleReconnect(config: WSConfig): Promise<void> {
        const delay = getReconnectDelay(config, currentAttempt);
        currentAttempt++;

        await new Promise<void>((resolve) => {
            reconnectTimer = setTimeout(resolve, delay);
        });

        tryReconnect(config);
    }

    /**
     * Attempt to reconnect after the scheduled delay
     */
    function tryReconnect(config: WSConfig): void {
        if (state !== WSState.CLOSED) return;
        startConnection(config);
    }

    /**
     * Finalize the close — run close hooks and clean up
     */
    function finalizeClose(
        config: WSConfig,
        code: number,
        reason: string,
        wasClean: boolean
    ): void {
        clearTimers();
        state = WSState.CLOSED;

        if (ws) {
            ws.onclose = null;
            ws.onerror = null;
            ws.onmessage = null;
            ws.onopen = null;
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
            ws = undefined;
        }

        hooks.runClose({
            config,
            code,
            reason,
            reconnectCount,
            wasClean,
        });
    }

    /**
     * Start the WebSocket connection
     */
    function startConnection(config?: WSConfig): void {
        // Note: callers (connect, tryReconnect) already guard against CONNECTING/OPEN state

        const { mergedConfig, url: resolvedURL } = prepareConfig();
        const effectiveConfig = config || mergedConfig;
        fullURL = resolvedURL;

        state = WSState.CONNECTING;

        try {
            const WebSocketCtor =
                effectiveConfig.webSocketImpl ||
                (typeof WebSocket !== 'undefined' ? WebSocket : undefined);

            if (!WebSocketCtor) {
                throw new WSError(
                    'WebSocket is not available in this environment',
                    WSErrorType.CONFIG,
                    effectiveConfig
                );
            }

            ws = new WebSocketCtor(resolvedURL, effectiveConfig.protocols);

            if (effectiveConfig.binaryType) {
                ws!.binaryType = effectiveConfig.binaryType;
            }

            setupEventHandlers(ws!, effectiveConfig);
            startTimeout(effectiveConfig);
        } catch (err) {
            const wsError =
                err instanceof WSError
                    ? err
                    : new WSError(
                          getWSErrorMessage(err),
                          WSErrorType.NETWORK,
                          effectiveConfig,
                          err instanceof Error ? err : undefined
                      );
            handleError(wsError);
        }
    }

    /**
     * Open the WebSocket connection
     */
    function connect(): void {
        if (state === WSState.CONNECTING || state === WSState.OPEN) return;
        manualClose = false;
        currentAttempt = 0;
        startConnection();
    }

    /**
     * Close the WebSocket connection
     */
    function close(code?: number, reason?: string): void {
        clearTimers();
        manualClose = true;

        if (state === WSState.CLOSED) return;

        const closeCode = code ?? 1000;
        const closeReason = reason ?? '';

        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            state = WSState.CLOSING;
            ws.close(closeCode, closeReason);
        } else {
            state = WSState.CLOSED;
            finalizeClose(mergeWSConfig(defaults, config), closeCode, closeReason, true);
        }
    }

    /**
     * Send data through the WebSocket
     */
    function send(data: string | ArrayBuffer | Blob | object): void {
        if (state !== WSState.OPEN || !ws || ws.readyState !== WebSocket.OPEN) {
            throw new WSError(
                'WebSocket is not open. Current state: ' + state,
                WSErrorType.NETWORK,
                mergeWSConfig(defaults, config)
            );
        }

        const serialized = serializeWSMessage(data);

        // Run send hooks
        hooks.runSend({
            config: mergeWSConfig(defaults, config),
            data,
        });

        ws.send(serialized);
    }

    const client: WSClient = {
        get state() {
            return state;
        },
        get url() {
            return fullURL;
        },
        get reconnectCount() {
            return reconnectCount;
        },
        get defaults() {
            return defaults;
        },

        connect,
        close,
        send,
        use,

        // Test-only: expose tryReconnect for branch coverage
        _tryReconnect: (cfg?: WSConfig) => tryReconnect(cfg || mergeWSConfig(defaults, config)),
    };

    return client;
}

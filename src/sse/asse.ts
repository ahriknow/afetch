/**
 * SSE Core Implementation
 * Server-Sent Events client
 */

import type { SSEConfig, SSEClient } from './types.js';
import { SSEState } from './types.js';
import { SSEErrorType } from './types.js';
import { SSEError } from './error.js';
import { SSEHookRunner } from './plugin.js';
import type { SSEPlugin, SSEPluginApi } from './plugin.js';
import {
    buildSSEURL,
    mergeSSEConfig,
    getReconnectDelay,
    getSSEErrorMessage,
    parseSSEChunk,
} from './utils.js';

/**
 * Create an SSE client instance
 */
export function createSSE(url: string, config: SSEConfig = {}): SSEClient {
    const defaults: SSEConfig = { ...config };
    const hooks = new SSEHookRunner();
    const installedPlugins = new Set<string>();

    let state: SSEState = SSEState.CLOSED;
    let fullURL = '';
    let reconnectCount = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let abortController: AbortController | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    /**
     * Install a plugin
     */
    function use(plugin: SSEPlugin): void {
        if (installedPlugins.has(plugin.name)) return;
        installedPlugins.add(plugin.name);

        const api: SSEPluginApi = {
            addHook(type, fn) {
                if (type === 'connect') hooks.addConnect(fn as any);
                else if (type === 'message') hooks.addMessage(fn as any);
                else if (type === 'error') hooks.addError(fn as any);
                else if (type === 'close') hooks.addClose(fn as any);
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
    function prepareConfig(): { mergedConfig: SSEConfig; url: string } {
        const mergedConfig = mergeSSEConfig(defaults, config);
        const resolvedURL = buildSSEURL(mergedConfig.baseURL || '', url, mergedConfig.params);

        if (!resolvedURL) {
            throw new SSEError(
                'URL is required: provide either a url or a baseURL',
                SSEErrorType.CONFIG,
                mergedConfig
            );
        }

        return { mergedConfig, url: resolvedURL };
    }

    /**
     * Handle an error that occurred during connection/reading.
     * Returns true if reconnection should be attempted.
     */
    async function handleError(
        error: unknown,
        mergedConfig: SSEConfig,
        attempt: number
    ): Promise<boolean> {
        const sseError =
            error instanceof SSEError
                ? error
                : new SSEError(
                      getSSEErrorMessage(error, 'SSE connection error'),
                      SSEErrorType.NETWORK,
                      mergedConfig,
                      error instanceof Error ? error : undefined
                  );

        const preventReconnect = await hooks.runError({
            config: mergedConfig,
            error: sseError,
            attempt,
        });

        return !preventReconnect;
    }

    /**
     * Attempt to reconnect
     */
    function scheduleReconnect(mergedConfig: SSEConfig, attempt: number): void {
        // Don't schedule if already closed
        if ((state as SSEState) === SSEState.CLOSED) return;

        if (!mergedConfig.autoReconnect) {
            finalizeClose(mergedConfig);
            return;
        }

        if (attempt >= mergedConfig.maxReconnectAttempts!) {
            finalizeClose(mergedConfig);
            return;
        }

        const delay = getReconnectDelay(mergedConfig.reconnectDelay!, attempt);
        reconnectTimer = setTimeout(() => {
            reconnectTimer = undefined;
            startConnection(mergedConfig, attempt + 1);
        }, delay);
    }

    /**
     * Finalize closing: clean up and run close hooks
     */
    async function finalizeClose(mergedConfig: SSEConfig): Promise<void> {
        state = SSEState.CLOSED;
        cleanup();
        await hooks.runClose({
            config: mergedConfig,
            reconnectCount,
        });
    }

    /**
     * Clean up reader and abort controllers.
     * Note: reconnect timer is NOT cleared here - close() handles that.
     */
    function cleanup(): void {
        if (reader) {
            // Ignore the cancel promise (fire-and-forget)
            void reader.cancel();
            reader = undefined;
        }
        if (abortController) {
            abortController.abort();
            abortController = undefined;
        }
    }

    /**
     * Start the SSE connection and read the stream
     */
    async function startConnection(mergedConfig: SSEConfig, attempt: number): Promise<void> {
        state = SSEState.CONNECTING;
        cleanup();

        abortController = new AbortController();
        const fetchFn = mergedConfig.fetchAdapter || globalThis.fetch;

        try {
            const response = await fetchFn(fullURL, {
                method: 'GET',
                headers: {
                    Accept: 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    ...mergedConfig.headers,
                },
                signal: abortController.signal,
            });

            if (!response.ok) {
                throw new SSEError(
                    `SSE connection failed with status ${response.status}`,
                    SSEErrorType.NETWORK,
                    mergedConfig
                );
            }

            if (!response.body) {
                throw new SSEError(
                    'Response body is not readable (streaming not supported)',
                    SSEErrorType.NETWORK,
                    mergedConfig
                );
            }

            state = SSEState.OPEN;
            reconnectCount = attempt;

            // Run connect hooks
            await hooks.runConnect({
                config: mergedConfig,
                url: fullURL,
            });

            // Read the stream
            reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    // Stream ended normally
                    await finalizeClose(mergedConfig);
                    return;
                }

                buffer += decoder.decode(value, { stream: true });

                // Parse complete events from buffer
                const { events, remaining } = parseSSEChunk(buffer);
                buffer = remaining;

                for (const event of events) {
                    await hooks.runMessage({
                        config: mergedConfig,
                        event,
                    });

                    // Update retry interval from event if specified
                    if (
                        event.retry !== undefined &&
                        typeof mergedConfig.reconnectDelay !== 'function'
                    ) {
                        mergedConfig.reconnectDelay = event.retry;
                        defaults.reconnectDelay = event.retry;
                    }
                }
            }
        } catch (error) {
            // Ignore errors after manual close (state is a mutable closure, check runtime)
            if ((state as SSEState) === SSEState.CLOSED) return;

            const shouldReconnect = await handleError(error, mergedConfig, attempt);
            if (shouldReconnect) {
                scheduleReconnect(mergedConfig, attempt);
            } else {
                finalizeClose(mergedConfig);
            }
        }
    }

    /**
     * Start the SSE connection
     */
    function connect(): void {
        if (state !== SSEState.CLOSED) return;

        try {
            const { mergedConfig, url: resolvedURL } = prepareConfig();
            fullURL = resolvedURL;
            reconnectCount = 0;
            state = SSEState.CONNECTING;

            // Fire-and-forget: errors are handled inside startConnection
            startConnection(mergedConfig, 0);
        } catch (error) {
            // prepareConfig only throws SSEError
            throw error;
        }
    }

    /**
     * Close the SSE connection
     */
    function close(): void {
        if (state === SSEState.CLOSED) return;

        state = SSEState.CLOSED;
        cleanup();

        // Clear any pending reconnect timer
        if (reconnectTimer !== undefined) {
            clearTimeout(reconnectTimer);
            reconnectTimer = undefined;
        }

        const mergedConfig = mergeSSEConfig(defaults, config);
        void hooks.runClose({
            config: mergedConfig,
            reconnectCount,
        });
    }

    return {
        get state() {
            return state;
        },
        get url() {
            return fullURL;
        },
        get reconnectCount() {
            return reconnectCount;
        },
        connect,
        close,
        use,
        defaults,
    };
}

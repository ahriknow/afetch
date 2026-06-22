/**
 * Auto Reconnect Plugin
 * Provides automatic reconnection with configurable backoff for SSE connections
 */

import type { SSEPlugin, SSEPluginApi, SSEErrorContext } from '../plugin.js';

export interface AutoReconnectOptions {
    /** Maximum number of reconnect attempts (default: Infinity) */
    maxAttempts?: number;
    /** Reconnect delay in ms, or function returning delay based on attempt (default: 3000) */
    delay?: number | ((attempt: number) => number);
    /** Optional: decide whether to reconnect based on the error */
    shouldReconnect?: (ctx: SSEErrorContext) => boolean;
}

/**
 * Create an auto-reconnect plugin for SSE.
 *
 * This plugin hooks into the error lifecycle to enable automatic reconnection.
 * By default, it allows reconnection for all errors.
 *
 * Note: The core SSE engine handles the actual reconnection logic.
 * This plugin provides a way to customize reconnection behavior.
 */
export function createAutoReconnectPlugin(options: AutoReconnectOptions = {}): SSEPlugin {
    const { maxAttempts, delay, shouldReconnect } = options;

    return {
        name: 'sse-auto-reconnect',
        install(api: SSEPluginApi) {
            api.addHook('error', (ctx: SSEErrorContext): boolean | void => {
                // Check max attempts
                if (maxAttempts !== undefined && ctx.attempt >= maxAttempts) {
                    return false; // prevent reconnect
                }

                // Custom shouldReconnect check
                if (shouldReconnect && !shouldReconnect(ctx)) {
                    return false; // prevent reconnect
                }

                // Allow reconnect (override delay if configured)
                if (delay !== undefined) {
                    // The core reads reconnectDelay from config, so we update it
                    ctx.config.reconnectDelay = delay;
                }

                // Return void = allow reconnect (default behavior)
                return undefined;
            });
        },
    };
}

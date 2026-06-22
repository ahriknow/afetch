/**
 * aws - Auto-Reconnect Plugin
 * Controls WebSocket reconnection behavior
 */

import type { WSPlugin, WSPluginApi, WSErrorContext } from '../plugin.js';

export interface AutoReconnectOptions {
    /** Maximum number of reconnect attempts */
    maxAttempts?: number;
    /** Reconnect delay in ms (static or function of attempt) */
    delay?: number | ((attempt: number) => number);
    /** Custom predicate to decide whether to reconnect */
    shouldReconnect?: (ctx: WSErrorContext) => boolean;
}

/**
 * Create an auto-reconnect plugin for WebSocket
 *
 * The core engine handles the actual reconnection loop.
 * This plugin lets you customize when and with what delay reconnection happens.
 */
export function createAutoReconnectPlugin(options: AutoReconnectOptions = {}): WSPlugin {
    return {
        name: 'auto-reconnect',
        install(api: WSPluginApi) {
            api.addHook('error', (ctx: WSErrorContext) => {
                // Check max attempts
                if (options.maxAttempts !== undefined && ctx.attempt >= options.maxAttempts) {
                    return false; // prevent reconnect
                }

                // Check custom predicate
                if (options.shouldReconnect && !options.shouldReconnect(ctx)) {
                    return false; // prevent reconnect
                }

                // Override delay if configured
                if (options.delay !== undefined) {
                    ctx.config.reconnectDelay = options.delay;
                }

                // Return void to allow reconnection
            });
        },
    };
}

/**
 * SSE Plugin System
 * Plugin infrastructure for the SSE module
 */

import type { SSEEvent, SSEConfig } from './types.js';
import type { SSEError } from './error.js';

// ─── Hook contexts ──────────────────────────────────────────

export interface SSEConnectContext {
    config: SSEConfig;
    url: string;
}

export interface SSEMessageContext {
    config: SSEConfig;
    event: SSEEvent;
}

export interface SSEErrorContext {
    config: SSEConfig;
    error: SSEError;
    /** Current reconnect attempt (0-based) */
    attempt: number;
}

export interface SSECloseContext {
    config: SSEConfig;
    /** Total reconnect count when closing */
    reconnectCount: number;
}

// ─── Hook types ─────────────────────────────────────────────

export type SSEConnectHook = (ctx: SSEConnectContext) => void | Promise<void>;
export type SSEMessageHook = (ctx: SSEMessageContext) => void | Promise<void>;
export type SSEErrorHook = (ctx: SSEErrorContext) => boolean | void | Promise<boolean | void>;
export type SSECloseHook = (ctx: SSECloseContext) => void | Promise<void>;

// ─── Plugin API ─────────────────────────────────────────────

export interface SSEPluginApi {
    addHook(hook: 'connect', fn: SSEConnectHook): void;
    addHook(hook: 'message', fn: SSEMessageHook): void;
    addHook(hook: 'error', fn: SSEErrorHook): void;
    addHook(hook: 'close', fn: SSECloseHook): void;
    addHook(hook: string, fn: (...args: any[]) => any): void;
}

export interface SSEPlugin {
    name: string;
    install(api: SSEPluginApi): void;
}

// ─── Hook runner ────────────────────────────────────────────

export class SSEHookRunner {
    private connectHooks: SSEConnectHook[] = [];
    private messageHooks: SSEMessageHook[] = [];
    private errorHooks: SSEErrorHook[] = [];
    private closeHooks: SSECloseHook[] = [];

    addConnect(fn: SSEConnectHook): void {
        this.connectHooks.push(fn);
    }

    addMessage(fn: SSEMessageHook): void {
        this.messageHooks.push(fn);
    }

    addError(fn: SSEErrorHook): void {
        this.errorHooks.push(fn);
    }

    addClose(fn: SSECloseHook): void {
        this.closeHooks.push(fn);
    }

    async runConnect(ctx: SSEConnectContext): Promise<void> {
        for (const hook of this.connectHooks) {
            await hook(ctx);
        }
    }

    async runMessage(ctx: SSEMessageContext): Promise<void> {
        for (const hook of this.messageHooks) {
            await hook(ctx);
        }
    }

    /**
     * Run error hooks. Returns true if any hook wants to prevent reconnection.
     */
    async runError(ctx: SSEErrorContext): Promise<boolean> {
        for (const hook of this.errorHooks) {
            const result = await hook(ctx);
            if (result === false) {
                return true; // prevent reconnect
            }
        }
        return false;
    }

    async runClose(ctx: SSECloseContext): Promise<void> {
        for (const hook of this.closeHooks) {
            await hook(ctx);
        }
    }
}

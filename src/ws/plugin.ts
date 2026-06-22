/**
 * aws - WebSocket Plugin System
 * Plugin infrastructure for the WebSocket module
 */

import type { WSMessage, WSConfig } from './types.js';
import type { WSError } from './error.js';

// ─── Hook contexts ──────────────────────────────────────────

export interface WSOpenContext {
    config: WSConfig;
    url: string;
}

export interface WSMessageContext {
    config: WSConfig;
    message: WSMessage;
}

export interface WSErrorContext {
    config: WSConfig;
    error: WSError;
    /** Current reconnect attempt (0-based) */
    attempt: number;
}

export interface WSCloseContext {
    config: WSConfig;
    /** Close event code */
    code: number;
    /** Close event reason */
    reason: string;
    /** Total reconnect count when closing */
    reconnectCount: number;
    /** Whether the close was initiated by the client */
    wasClean: boolean;
}

export interface WSSendContext {
    config: WSConfig;
    /** The data being sent */
    data: string | ArrayBuffer | Blob | object;
}

// ─── Hook types ─────────────────────────────────────────────

export type WSOpenHook = (ctx: WSOpenContext) => void | Promise<void>;
export type WSMessageHook = (ctx: WSMessageContext) => void | Promise<void>;
export type WSErrorHook = (ctx: WSErrorContext) => boolean | void | Promise<boolean | void>;
export type WSCloseHook = (ctx: WSCloseContext) => void | Promise<void>;
export type WSSendHook = (ctx: WSSendContext) => void | Promise<void>;

// ─── Plugin API ─────────────────────────────────────────────

export interface WSPluginApi {
    addHook(hook: 'open', fn: WSOpenHook): void;
    addHook(hook: 'message', fn: WSMessageHook): void;
    addHook(hook: 'error', fn: WSErrorHook): void;
    addHook(hook: 'close', fn: WSCloseHook): void;
    addHook(hook: 'send', fn: WSSendHook): void;
    addHook(hook: string, fn: (...args: any[]) => any): void;
}

export interface WSPlugin {
    name: string;
    install(api: WSPluginApi): void;
}

// ─── Hook runner ────────────────────────────────────────────

export class WSHookRunner {
    private openHooks: WSOpenHook[] = [];
    private messageHooks: WSMessageHook[] = [];
    private errorHooks: WSErrorHook[] = [];
    private closeHooks: WSCloseHook[] = [];
    private sendHooks: WSSendHook[] = [];

    addOpen(fn: WSOpenHook): void {
        this.openHooks.push(fn);
    }

    addMessage(fn: WSMessageHook): void {
        this.messageHooks.push(fn);
    }

    addError(fn: WSErrorHook): void {
        this.errorHooks.push(fn);
    }

    addClose(fn: WSCloseHook): void {
        this.closeHooks.push(fn);
    }

    addSend(fn: WSSendHook): void {
        this.sendHooks.push(fn);
    }

    async runOpen(ctx: WSOpenContext): Promise<void> {
        for (const hook of this.openHooks) {
            await hook(ctx);
        }
    }

    async runMessage(ctx: WSMessageContext): Promise<void> {
        for (const hook of this.messageHooks) {
            await hook(ctx);
        }
    }

    /**
     * Run error hooks. Returns true if any hook wants to prevent reconnection.
     */
    async runError(ctx: WSErrorContext): Promise<boolean> {
        for (const hook of this.errorHooks) {
            const result = await hook(ctx);
            if (result === false) {
                return true; // prevent reconnect
            }
        }
        return false;
    }

    async runClose(ctx: WSCloseContext): Promise<void> {
        for (const hook of this.closeHooks) {
            await hook(ctx);
        }
    }

    async runSend(ctx: WSSendContext): Promise<void> {
        for (const hook of this.sendHooks) {
            await hook(ctx);
        }
    }
}

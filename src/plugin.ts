/**
 * afetch - Plugin System
 * Core plugin infrastructure
 */

import type { ResolvedRequestConfig, AResponse, AFetchError } from './types.js';

// ─── Hook types ────────────────────────────────────────────────

export interface BeforeRequestContext {
    config: ResolvedRequestConfig;
}

export interface AfterResponseContext {
    config: ResolvedRequestConfig;
    response: AResponse;
}

export interface OnErrorContext {
    config: ResolvedRequestConfig;
    error: AFetchError;
}

export type BeforeRequestHook = (ctx: BeforeRequestContext) => void | Promise<void>;
export type AfterResponseHook = (
    ctx: AfterResponseContext
) => AResponse | void | Promise<AResponse | void>;
export type OnErrorHook = (ctx: OnErrorContext) => AResponse | void | Promise<AResponse | void>;

/** Cleanup function returned by plugin.use() */
export type PluginCleanup = () => void;

// ─── Plugin interface ──────────────────────────────────────────

export interface AFetchPluginApi {
    addHook(hook: 'beforeRequest', fn: BeforeRequestHook): void;
    addHook(hook: 'afterResponse', fn: AfterResponseHook): void;
    addHook(hook: 'onError', fn: OnErrorHook): void;
}

export interface AFetchPlugin {
    name: string;
    install(api: AFetchPluginApi): void;
}

// ─── Hook runner ───────────────────────────────────────────────

export class HookRunner {
    private beforeRequest: BeforeRequestHook[] = [];
    private afterResponse: AfterResponseHook[] = [];
    private onError: OnErrorHook[] = [];

    addBeforeRequest(fn: BeforeRequestHook): void {
        this.beforeRequest.push(fn);
    }

    addAfterResponse(fn: AfterResponseHook): void {
        this.afterResponse.push(fn);
    }

    addOnError(fn: OnErrorHook): void {
        this.onError.push(fn);
    }

    async runBeforeRequest(config: ResolvedRequestConfig): Promise<void> {
        const ctx: BeforeRequestContext = { config };
        for (const hook of this.beforeRequest) {
            await hook(ctx);
        }
    }

    async runAfterResponse(config: ResolvedRequestConfig, response: AResponse): Promise<AResponse> {
        const ctx: AfterResponseContext = { config, response };
        for (const hook of this.afterResponse) {
            const result = await hook(ctx);
            if (result) {
                ctx.response = result;
            }
        }
        return ctx.response;
    }

    async runOnError(
        config: ResolvedRequestConfig,
        error: AFetchError
    ): Promise<AResponse | undefined> {
        const ctx: OnErrorContext = { config, error };
        for (const hook of this.onError) {
            const result = await hook(ctx);
            if (result) {
                return result;
            }
        }
        return undefined;
    }
}

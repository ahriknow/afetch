/**
 * afetch - Retry Plugin
 * Provides retry capability for failed requests
 */

import type {
    ResolvedRequestConfig,
    RetryOnConfig,
    AResponse,
    AFetchError as AFetchErrorInterface,
} from '../types.js';
import { AFetchErrorType } from '../types.js';
import { AFetchError } from '../error.js';
import type { AFetchPlugin, AFetchPluginApi } from '../plugin.js';
import { buildURL, parseResponse, resolveFetchFn } from '../utils.js';

// ─── Retry options (stored in config.meta.retry) ───────────────

export interface RetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Custom retry condition: return true to retry */
    condition?: (attempt: number, error: AFetchErrorInterface) => boolean;
    /** Delay between retries in ms (default: 1000) */
    delay?: number | ((attempt: number, error: AFetchErrorInterface) => number);
    /** Advanced retry conditions with hooks */
    retryOn?: (number | RetryOnConfig)[];
}

// ─── Helpers ───────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDelay(
    attempt: number,
    delay: number | ((attempt: number, error: AFetchErrorInterface) => number) | undefined,
    error: AFetchErrorInterface
): number {
    if (typeof delay === 'function') return delay(attempt, error);
    if (typeof delay === 'number') return delay;
    return 1000;
}

async function checkRetryOn(
    error: AFetchErrorInterface,
    retryOn: (number | RetryOnConfig)[]
): Promise<{ match: boolean; retryDelay?: number; call?: () => Promise<void> }> {
    const status = error.status;
    for (const entry of retryOn) {
        if (typeof entry === 'number') {
            if (status === entry) return { match: true };
        } else {
            if (await entry.hook(error)) {
                return { match: true, retryDelay: entry.retryDelay, call: entry.call };
            }
        }
    }
    return { match: false };
}

function executeFetch(config: ResolvedRequestConfig): Promise<Response> {
    const fetchFn = resolveFetchFn(config);
    const fullURL = buildURL(config.baseURL, config.url, config.params);
    const request = new Request(fullURL, {
        method: config.method,
        headers: config.headers,
        body: config.body as BodyInit | null,
        signal: config.signal,
        cache: config.cache,
        credentials: config.credentials,
        redirect: config.redirect,
        referrer: config.referrer,
        referrerPolicy: config.referrerPolicy,
    });
    return fetchFn(request);
}

async function buildResponse(raw: Response, config: ResolvedRequestConfig): Promise<AResponse> {
    let data: unknown;
    try {
        data = await parseResponse(raw, config.responseType);
    } catch {
        data = undefined;
    }
    return {
        data,
        status: raw.status,
        statusText: raw.statusText,
        headers: raw.headers,
        config,
        raw,
        ok: raw.ok,
    };
}

// ─── Plugin factory ────────────────────────────────────────────

export function createRetryPlugin(defaultOptions?: RetryOptions): AFetchPlugin {
    return {
        name: 'retry',

        install(api: AFetchPluginApi): void {
            api.addHook('onError', async ({ config, error }) => {
                const requestOpts = config.meta?.retry as RetryOptions | undefined;

                // Merge plugin defaults with request-level options
                // If neither exists, don't retry
                if (!defaultOptions && !requestOpts) return undefined;

                const opts: RetryOptions = { ...defaultOptions, ...requestOpts };

                // Never retry on abort or timeout — these are intentional cancellations
                if (error.code === AFetchErrorType.ABORT || error.code === AFetchErrorType.TIMEOUT)
                    return undefined;

                let maxRetries: number;
                if (opts.maxRetries !== undefined && opts.maxRetries !== null) {
                    maxRetries = opts.maxRetries;
                } else {
                    maxRetries = 3;
                }

                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    // Custom condition check
                    if (opts.condition && !opts.condition(attempt, error)) return undefined;

                    // Determine delay and call
                    let delayMs: number;
                    let callFn: (() => Promise<void>) | undefined;

                    if (opts.retryOn && opts.retryOn.length > 0) {
                        const check = await checkRetryOn(error, opts.retryOn);
                        if (!check.match) return undefined;
                        if (check.retryDelay !== undefined && check.retryDelay !== null) {
                            delayMs = check.retryDelay;
                        } else {
                            delayMs = getDelay(attempt, opts.delay, error);
                        }
                        callFn = check.call;
                    } else {
                        delayMs = getDelay(attempt, opts.delay, error);
                    }

                    // Execute call hook and delay
                    if (callFn) await callFn();
                    if (delayMs > 0) await sleep(delayMs);

                    // Execute retry
                    try {
                        const raw = await executeFetch(config);
                        const response = await buildResponse(raw, config);
                        // If retry got a successful response, return it
                        if (raw.ok) return response;
                        // Otherwise, update error and continue loop
                        error = new AFetchError(
                            `Retry failed with status ${raw.status}`,
                            AFetchErrorType.HTTP,
                            config,
                            response
                        );
                    } catch (e) {
                        // Retry failed, update error and continue loop
                        if (e instanceof AFetchError) {
                            error = e;
                        } else {
                            let errorMessage: string;
                            if ((e as Error).message) {
                                errorMessage = (e as Error).message;
                            } else {
                                errorMessage = 'Retry failed';
                            }
                            error = new AFetchError(
                                errorMessage,
                                AFetchErrorType.NETWORK,
                                config,
                                undefined,
                                e as Error
                            );
                        }
                    }
                }

                // All retries exhausted
                return undefined;
            });
        },
    };
}

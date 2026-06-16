/**
 * afetch - Cache Plugin
 * In-memory response caching for GET requests
 */

import type { ResolvedRequestConfig, AResponse } from '../types.js';
import type { AFetchPlugin, AFetchPluginApi } from '../plugin.js';

/** Return type for the shouldCache callback */
export interface CacheDecision {
    /** Custom max age in milliseconds for this specific response */
    maxAge: number;
}

export interface CacheOptions {
    /** Default cache max age in milliseconds (default: 5 minutes) */
    maxAge?: number;
    /** Maximum cache entries (default: 100) */
    maxSize?: number;
    /**
     * Per-request cache decision callback.
     * Return `false` to skip caching, `true` to cache with default maxAge,
     * or `{ maxAge }` to cache with a custom TTL.
     */
    shouldCache?: (config: ResolvedRequestConfig, response: AResponse) => boolean | CacheDecision;
}

interface CacheEntry {
    response: AResponse;
    timestamp: number;
    maxAge: number;
}

function defaultCacheKey(config: ResolvedRequestConfig): string {
    const url = config.baseURL + config.url;
    const params = config.params
        ? '?' + new URLSearchParams(config.params as Record<string, string>).toString()
        : '';
    return `GET:${url}${params}`;
}

/**
 * Create a cache plugin that caches GET responses
 */
export function createCachePlugin(options: CacheOptions = {}): AFetchPlugin {
    const defaultMaxAge = options.maxAge ?? 5 * 60 * 1000;
    const maxSize = options.maxSize ?? 100;
    const shouldCache = options.shouldCache;
    const cache = new Map<string, CacheEntry>();

    function evict(): void {
        if (cache.size <= maxSize) return;
        const entries = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = cache.size - maxSize;
        for (let i = 0; i < toRemove; i++) {
            cache.delete(entries[i][0]);
        }
    }

    return {
        name: 'cache',
        install(api: AFetchPluginApi): void {
            api.addHook('beforeRequest', ({ config }) => {
                if (config.method !== 'GET') return;

                const key = defaultCacheKey(config);
                const entry = cache.get(key);
                if (entry) {
                    if (Date.now() - entry.timestamp <= entry.maxAge) {
                        return entry.response;
                    }
                    cache.delete(key);
                }
                return undefined;
            });

            api.addHook('afterResponse', ({ config, response }) => {
                if (config.method !== 'GET') return;
                if (!response.ok) return;

                // Determine cache decision
                if (shouldCache) {
                    const decision = shouldCache(config, response);
                    if (decision === false) return response;
                    const entryMaxAge =
                        decision === true || decision === undefined
                            ? defaultMaxAge
                            : decision.maxAge;
                    const key = defaultCacheKey(config);
                    cache.set(key, { response, timestamp: Date.now(), maxAge: entryMaxAge });
                } else {
                    const key = defaultCacheKey(config);
                    cache.set(key, { response, timestamp: Date.now(), maxAge: defaultMaxAge });
                }
                evict();
                return response;
            });
        },
    };
}

/**
 * Standalone in-memory response cache
 *
 * @example
 * ```typescript
 * const cache = new ResponseCache(60000, 100);
 * const key = 'GET:/api/users';
 *
 * const cached = cache.get(key);
 * if (cached) return cached;
 *
 * const response = await api.get('/api/users');
 * cache.set(key, response);
 * return response;
 * ```
 */
export class ResponseCache {
    private cache = new Map<string, CacheEntry>();

    constructor(
        private maxAge: number = 5 * 60 * 1000,
        private maxSize: number = 100
    ) {}

    get(key: string): AResponse | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;
        if (Date.now() - entry.timestamp > entry.maxAge) {
            this.cache.delete(key);
            return undefined;
        }
        return entry.response;
    }

    set(key: string, response: AResponse): void {
        this.cache.set(key, { response, timestamp: Date.now(), maxAge: this.maxAge });
        this.evict();
    }

    has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }

    private evict(): void {
        if (this.cache.size <= this.maxSize) return;
        const entries = [...this.cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = this.cache.size - this.maxSize;
        for (let i = 0; i < toRemove; i++) {
            this.cache.delete(entries[i][0]);
        }
    }
}

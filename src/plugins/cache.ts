/**
 * afetch - Cache Plugin
 * In-memory response caching for GET requests
 */

import type { ResolvedRequestConfig, AResponse } from '../types.js';
import type { AFetchPlugin, AFetchPluginApi } from '../plugin.js';
import { buildURL } from '../utils.js';

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
     * Cache partition for the request, such as a tenant or user ID.
     * Requests with Authorization or Cookie headers are not cached unless this is provided.
     */
    cacheKey?: (config: ResolvedRequestConfig) => string;
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

function defaultCacheKey(
    config: ResolvedRequestConfig,
    cacheKey?: CacheOptions['cacheKey']
): string | undefined {
    if (!cacheKey && ('authorization' in config.headers || 'cookie' in config.headers)) {
        return undefined;
    }

    const url = buildURL(config.baseURL, config.url, config.params);
    const partition = cacheKey?.(config);
    return partition === undefined ? `GET:${url}` : `GET:${url}:${partition}`;
}

/**
 * Create a cache plugin that caches GET responses
 */
export function createCachePlugin(options: CacheOptions = {}): AFetchPlugin {
    const defaultMaxAge = options.maxAge ?? 5 * 60 * 1000;
    const maxSize = options.maxSize ?? 100;
    const shouldCache = options.shouldCache;
    const cacheKey = options.cacheKey;
    const cache = new Map<string, CacheEntry>();

    // Evict oldest entries when cache exceeds maxSize.
    // Map preserves insertion order (ES2015), so keys().next() returns the oldest entry (FIFO).
    function evict(): void {
        while (cache.size > maxSize) {
            const oldest = cache.keys().next().value;
            if (oldest !== undefined) cache.delete(oldest);
        }
    }

    return {
        name: 'cache',
        install(api: AFetchPluginApi): void {
            api.addHook('beforeRequest', ({ config }) => {
                if (config.method !== 'GET') return;

                const key = defaultCacheKey(config, cacheKey);
                if (key === undefined) return;
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
                // Only cache successful GET requests
                if (config.method !== 'GET') return undefined;
                if (!response.ok) return undefined;
                const key = defaultCacheKey(config, cacheKey);
                if (key === undefined) return undefined;

                // Cached responses pass through afterResponse so plugins can release request resources.
                if (cache.get(key)?.response === response) return undefined;

                // Determine cache decision
                if (shouldCache) {
                    const decision = shouldCache(config, response);
                    if (decision === false) return undefined;
                    const entryMaxAge =
                        decision === true || decision === undefined
                            ? defaultMaxAge
                            : decision.maxAge;
                    cache.set(key, { response, timestamp: Date.now(), maxAge: entryMaxAge });
                } else {
                    cache.set(key, { response, timestamp: Date.now(), maxAge: defaultMaxAge });
                }
                evict();
                return undefined;
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
        while (this.cache.size > this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest !== undefined) this.cache.delete(oldest);
        }
    }
}

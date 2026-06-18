/**
 * afetch - Utilities
 * Helper functions for afetch
 */

import type {
    ResolvedRequestConfig,
    AFetchOptions,
    AFetchConfig,
    RequestTransform,
    ResponseTransform,
} from './types.js';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<
    Pick<
        AFetchConfig,
        'timeout' | 'responseType' | 'cache' | 'credentials' | 'redirect' | 'throwOnError'
    >
> = {
    timeout: 0,
    responseType: 'json',
    cache: 'default',
    credentials: 'same-origin',
    redirect: 'follow',
    throwOnError: true,
};

/**
 * Default headers
 */
export const DEFAULT_HEADERS: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
};

/**
 * Build a full URL with query parameters
 */
export function buildURL(
    baseURL: string,
    url: string,
    params?: Record<string, string | number | boolean | undefined | null>
): string {
    let fullURL = url;

    if (baseURL && !isAbsoluteURL(url)) {
        fullURL = joinURL(baseURL, url);
    }

    if (!params || Object.keys(params).length === 0) {
        return fullURL;
    }

    const parts = fullURL.split('#');
    const hash = parts[1] ? `#${parts[1]}` : '';
    const baseURLPart = parts[0];

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
        }
    }

    const queryString = searchParams.toString();
    if (queryString) {
        const separator = baseURLPart.includes('?') ? '&' : '?';
        return `${baseURLPart}${separator}${queryString}${hash}`;
    }

    return fullURL + hash;
}

/**
 * Check if a URL is absolute
 */
export function isAbsoluteURL(url: string): boolean {
    return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

/**
 * Join a base URL and a relative URL
 */
export function joinURL(baseURL: string, relativeURL: string): string {
    const base = baseURL.replace(/\/+$/, '');
    const relative = relativeURL.replace(/^\/+/, '');
    return `${base}/${relative}`;
}

/**
 * Merge headers from multiple sources
 */
export function mergeHeaders(
    ...headerSets: Array<Record<string, string> | Headers | undefined>
): Record<string, string> {
    const result: Record<string, string> = {};

    for (const headers of headerSets) {
        if (!headers) continue;

        if (headers instanceof Headers) {
            headers.forEach((value, key) => {
                result[key.toLowerCase()] = value;
            });
        } else {
            for (const [key, value] of Object.entries(headers)) {
                if (value !== undefined) {
                    result[key.toLowerCase()] = value;
                }
            }
        }
    }

    return result;
}

/**
 * Determine if the request should have a body
 */
export function shouldHaveBody(method: string): boolean {
    return ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase());
}

/**
 * Determine if data should be serialized as JSON
 */
export function shouldSerializeAsJSON(data: unknown): boolean {
    if (data === null) return false;
    if (data === undefined) return false;
    if (typeof data === 'string') return false;
    if (data instanceof FormData) return false;
    if (data instanceof URLSearchParams) return false;
    if (data instanceof Blob) return false;
    if (data instanceof ArrayBuffer) return false;
    if (data instanceof ReadableStream) return false;
    if (ArrayBuffer.isView(data)) return false;
    return true;
}

/** Resolve value with 3-level fallback: options > defaults > fallback */
function resolveOpt<T>(
    options: T | undefined | null,
    defaults: T | undefined | null,
    fallback: T
): T {
    if (options !== undefined && options !== null) {
        return options;
    }
    if (defaults !== undefined && defaults !== null) {
        return defaults;
    }
    return fallback;
}

/** Resolve value with 2-level fallback: options > defaults */
function resolveFallback<T>(
    options: T | undefined | null,
    defaults: T | undefined | null
): T | undefined {
    if (options !== undefined && options !== null) {
        return options;
    }
    if (defaults !== undefined && defaults !== null) {
        return defaults;
    }
    return undefined;
}

/** Resolve a single value with fallback */
function resolveValue<T>(val: T | undefined | null, fallback: T): T {
    if (val !== undefined && val !== null) {
        return val;
    }
    return fallback;
}

/** Resolve the fetch function from config */
export function resolveFetchFn(config: ResolvedRequestConfig): typeof fetch {
    if (config.fetchAdapter) {
        return config.fetchAdapter;
    }
    return globalThis.fetch;
}

/**
 * Merge request options with defaults
 */
export function mergeConfig(
    defaults: AFetchConfig,
    options: AFetchOptions = {}
): ResolvedRequestConfig {
    const method = (
        options.method ? options.method.toUpperCase() : 'GET'
    ) as ResolvedRequestConfig['method'];

    const baseURL = resolveOpt(options.baseURL, defaults.baseURL, '');

    // Merge headers
    const mergedHeaders: Record<string, string> = {
        ...DEFAULT_HEADERS,
        ...defaults.headers,
        ...options.headers,
    };

    // Remove Content-Type for GET/HEAD requests without body
    if (!shouldHaveBody(method) && !options.body) {
        delete mergedHeaders['content-type'];
        delete mergedHeaders['Content-Type'];
    }

    // Merge meta
    const mergedMeta = { ...defaults.meta, ...options.meta };

    return {
        url: resolveValue(options.url, ''),
        baseURL,
        method,
        headers: mergedHeaders,
        body: options.body,
        timeout: resolveOpt(options.timeout, defaults.timeout, DEFAULT_CONFIG.timeout),
        signal: options.signal,
        responseType: resolveOpt(
            options.responseType,
            defaults.responseType,
            DEFAULT_CONFIG.responseType
        ),
        cache: resolveOpt(options.cache, defaults.cache, DEFAULT_CONFIG.cache),
        credentials: resolveOpt(
            options.credentials,
            defaults.credentials,
            DEFAULT_CONFIG.credentials
        ),
        redirect: resolveOpt(options.redirect, defaults.redirect, DEFAULT_CONFIG.redirect),
        referrer: resolveFallback(options.referrer, defaults.referrer),
        referrerPolicy: resolveFallback(options.referrerPolicy, defaults.referrerPolicy),
        params: options.params,
        transformRequest: resolveFallback(options.transformRequest, defaults.transformRequest),
        transformResponse: resolveFallback(options.transformResponse, defaults.transformResponse),
        onUploadProgress: options.onUploadProgress,
        onDownloadProgress: options.onDownloadProgress,
        meta: mergedMeta,
        throwOnError: resolveOpt(
            options.throwOnError,
            defaults.throwOnError,
            DEFAULT_CONFIG.throwOnError
        ),
        fetchAdapter: resolveFallback(options.fetchAdapter, defaults.fetchAdapter),
    };
}

/**
 * Parse response data based on response type
 */
export async function parseResponse(
    response: Response,
    responseType: ResolvedRequestConfig['responseType']
): Promise<unknown> {
    switch (responseType) {
        case 'json':
            return response.json();
        case 'text':
            return response.text();
        case 'blob':
            return response.blob();
        case 'arrayBuffer':
            return response.arrayBuffer();
        case 'formData':
            return response.formData();
        case 'stream':
            return response.body;
        default:
            return response.json();
    }
}

/**
 * Transform data using transform functions
 */
export function transformData<T>(
    data: T,
    transforms?: RequestTransform | RequestTransform[] | ResponseTransform | ResponseTransform[],
    arg?: unknown
): unknown {
    if (!transforms) return data;

    const transformArray = Array.isArray(transforms) ? transforms : [transforms];

    return transformArray.reduce((result, transform) => {
        return transform(result, arg as any);
    }, data as unknown);
}

/**
 * Create an AbortController with timeout support
 */
export function createTimeoutController(
    timeout: number,
    externalSignal?: AbortSignal
): { controller: AbortController; cleanup: () => void } {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (externalSignal) {
        if (externalSignal.aborted) {
            controller.abort(externalSignal.reason);
        } else {
            externalSignal.addEventListener(
                'abort',
                () => {
                    controller.abort(externalSignal.reason);
                },
                { once: true }
            );
        }
    }

    if (timeout > 0) {
        timeoutId = setTimeout(() => {
            controller.abort(new Error(`Request timed out after ${timeout}ms`));
        }, timeout);
    }

    return {
        controller,
        cleanup: () => {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }
        },
    };
}

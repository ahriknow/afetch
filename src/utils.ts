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

/**
 * Merge request options with defaults
 */
export function mergeConfig(
    defaults: AFetchConfig,
    options: AFetchOptions = {}
): ResolvedRequestConfig {
    let method: ResolvedRequestConfig['method'];
    if (options.method) {
        method = options.method.toUpperCase() as ResolvedRequestConfig['method'];
    } else {
        method = 'GET';
    }

    let baseURL: string;
    if (options.baseURL) {
        baseURL = options.baseURL;
    } else if (defaults.baseURL) {
        baseURL = defaults.baseURL;
    } else {
        baseURL = '';
    }

    // Merge headers
    let defaultHeaders: Record<string, string>;
    if (defaults.headers) {
        defaultHeaders = defaults.headers;
    } else {
        defaultHeaders = {};
    }
    let optionHeaders: Record<string, string>;
    if (options.headers) {
        optionHeaders = options.headers;
    } else {
        optionHeaders = {};
    }
    const mergedHeaders: Record<string, string> = {
        ...DEFAULT_HEADERS,
        ...defaultHeaders,
        ...optionHeaders,
    };

    // Remove Content-Type for GET/HEAD requests without body
    if (!shouldHaveBody(method) && !options.body) {
        delete mergedHeaders['content-type'];
        delete mergedHeaders['Content-Type'];
    }

    // Merge meta
    let defaultsMeta: Record<string, unknown>;
    if (defaults.meta !== undefined && defaults.meta !== null) {
        defaultsMeta = defaults.meta;
    } else {
        defaultsMeta = {};
    }
    let optionsMeta: Record<string, unknown>;
    if (options.meta !== undefined && options.meta !== null) {
        optionsMeta = options.meta;
    } else {
        optionsMeta = {};
    }
    const mergedMeta = { ...defaultsMeta, ...optionsMeta };

    // Resolve url
    let url: string;
    if (options.url !== undefined && options.url !== null) {
        url = options.url;
    } else {
        url = '';
    }

    // Resolve timeout
    let timeout: number;
    if (options.timeout !== undefined && options.timeout !== null) {
        timeout = options.timeout;
    } else if (defaults.timeout !== undefined && defaults.timeout !== null) {
        timeout = defaults.timeout;
    } else {
        timeout = DEFAULT_CONFIG.timeout;
    }

    // Resolve responseType
    let responseType: ResolvedRequestConfig['responseType'];
    if (options.responseType !== undefined && options.responseType !== null) {
        responseType = options.responseType;
    } else if (defaults.responseType !== undefined && defaults.responseType !== null) {
        responseType = defaults.responseType;
    } else {
        responseType = DEFAULT_CONFIG.responseType;
    }

    // Resolve cache
    let cache: RequestCache;
    if (options.cache !== undefined && options.cache !== null) {
        cache = options.cache;
    } else if (defaults.cache !== undefined && defaults.cache !== null) {
        cache = defaults.cache;
    } else {
        cache = DEFAULT_CONFIG.cache;
    }

    // Resolve credentials
    let credentials: RequestCredentials;
    if (options.credentials !== undefined && options.credentials !== null) {
        credentials = options.credentials;
    } else if (defaults.credentials !== undefined && defaults.credentials !== null) {
        credentials = defaults.credentials;
    } else {
        credentials = DEFAULT_CONFIG.credentials;
    }

    // Resolve redirect
    let redirect: RequestRedirect;
    if (options.redirect !== undefined && options.redirect !== null) {
        redirect = options.redirect;
    } else if (defaults.redirect !== undefined && defaults.redirect !== null) {
        redirect = defaults.redirect;
    } else {
        redirect = DEFAULT_CONFIG.redirect;
    }

    // Resolve referrer
    let referrer: string | undefined;
    if (options.referrer !== undefined && options.referrer !== null) {
        referrer = options.referrer;
    } else {
        referrer = defaults.referrer;
    }

    // Resolve referrerPolicy
    let referrerPolicy: ReferrerPolicy | undefined;
    if (options.referrerPolicy !== undefined && options.referrerPolicy !== null) {
        referrerPolicy = options.referrerPolicy;
    } else {
        referrerPolicy = defaults.referrerPolicy;
    }

    // Resolve transformRequest
    let transformRequest: RequestTransform | RequestTransform[] | undefined;
    if (options.transformRequest !== undefined && options.transformRequest !== null) {
        transformRequest = options.transformRequest;
    } else {
        transformRequest = defaults.transformRequest;
    }

    // Resolve transformResponse
    let transformResponse: ResponseTransform | ResponseTransform[] | undefined;
    if (options.transformResponse !== undefined && options.transformResponse !== null) {
        transformResponse = options.transformResponse;
    } else {
        transformResponse = defaults.transformResponse;
    }

    // Resolve throwOnError
    let throwOnError: boolean;
    if (options.throwOnError !== undefined && options.throwOnError !== null) {
        throwOnError = options.throwOnError;
    } else if (defaults.throwOnError !== undefined && defaults.throwOnError !== null) {
        throwOnError = defaults.throwOnError;
    } else {
        throwOnError = DEFAULT_CONFIG.throwOnError;
    }

    // Resolve fetchAdapter
    let fetchAdapter: typeof fetch | undefined;
    if (options.fetchAdapter !== undefined && options.fetchAdapter !== null) {
        fetchAdapter = options.fetchAdapter;
    } else {
        fetchAdapter = defaults.fetchAdapter;
    }

    return {
        url,
        baseURL,
        method,
        headers: mergedHeaders,
        body: options.body,
        timeout,
        signal: options.signal,
        responseType,
        cache,
        credentials,
        redirect,
        referrer,
        referrerPolicy,
        params: options.params,
        transformRequest,
        transformResponse,
        onUploadProgress: options.onUploadProgress,
        onDownloadProgress: options.onDownloadProgress,
        meta: mergedMeta,
        throwOnError,
        fetchAdapter,
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

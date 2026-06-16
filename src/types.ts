/**
 * afetch - Types
 * Type definitions for the afetch library
 */

import type { AFetchPlugin } from './plugin.js';

/** HTTP request methods */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/** Response type for automatic parsing */
export type ResponseType = 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | 'stream';

/** Request transform function */
export type RequestTransform = (data: unknown, headers: Record<string, string>) => unknown;

/** Response transform function */
export type ResponseTransform = (data: unknown, response: AResponse) => unknown;

/** Progress event callback */
export type ProgressCallback = (event: { loaded: number; total: number; progress: number }) => void;

/** Cache key generator function */
export type CacheKeyGenerator = (config: ResolvedRequestConfig) => string;

/** RetryOn advanced config */
export interface RetryOnConfig {
    /** Async hook that returns true to trigger retry */
    hook: (error: AFetchError) => Promise<boolean>;
    /** Override retryDelay for this specific condition */
    retryDelay?: number;
    /** Callback executed before retrying (after hook returns true) */
    call?: () => Promise<void>;
}

/** Request configuration options */
export interface AFetchOptions {
    /** Request URL */
    url?: string;

    /** HTTP method */
    method?: HttpMethod;

    /** Request headers */
    headers?: Record<string, string>;

    /** Request body */
    body?: BodyInit | null;

    /** Request timeout in milliseconds */
    timeout?: number;

    /** AbortSignal for request cancellation */
    signal?: AbortSignal;

    /** Expected response type */
    responseType?: ResponseType;

    /** Request cache mode */
    cache?: RequestCache;

    /** Request credentials mode */
    credentials?: RequestCredentials;

    /** Request redirect mode */
    redirect?: RequestRedirect;

    /** Request referrer */
    referrer?: string;

    /** Request referrer policy */
    referrerPolicy?: ReferrerPolicy;

    /** Query parameters */
    params?: Record<string, string | number | boolean | undefined | null>;

    /** Base URL to prepend to the request URL */
    baseURL?: string;

    /** Request transform functions */
    transformRequest?: RequestTransform | RequestTransform[];

    /** Response transform functions */
    transformResponse?: ResponseTransform | ResponseTransform[];

    /** Upload progress callback */
    onUploadProgress?: ProgressCallback;

    /** Download progress callback */
    onDownloadProgress?: ProgressCallback;

    /** Custom metadata (plugin data, etc.) */
    meta?: Record<string, unknown>;

    /** Whether to throw on non-2xx status codes (default: true) */
    throwOnError?: boolean;

    /** Custom fetch implementation (defaults to globalThis.fetch) */
    fetchAdapter?: typeof fetch;
}

/** Resolved request configuration (after merging defaults) */
export interface ResolvedRequestConfig extends Required<
    Pick<
        AFetchOptions,
        | 'method'
        | 'headers'
        | 'timeout'
        | 'responseType'
        | 'cache'
        | 'credentials'
        | 'redirect'
        | 'throwOnError'
    >
> {
    url: string;
    baseURL: string;
    body?: BodyInit | null;
    signal?: AbortSignal;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    params?: Record<string, string | number | boolean | undefined | null>;
    transformRequest?: RequestTransform | RequestTransform[];
    transformResponse?: ResponseTransform | ResponseTransform[];
    onUploadProgress?: ProgressCallback;
    onDownloadProgress?: ProgressCallback;
    meta?: Record<string, unknown>;
    fetchAdapter?: typeof fetch;
}

/** afetch response wrapper */
export interface AResponse<T = unknown> {
    /** Parsed response data */
    data: T;

    /** HTTP status code */
    status: number;

    /** HTTP status text */
    statusText: string;

    /** Response headers */
    headers: Headers;

    /** The resolved request config */
    config: ResolvedRequestConfig;

    /** The original Response object */
    raw: Response;

    /** Whether the status is in the 2xx range */
    ok: boolean;
}

/** afetch instance configuration */
export interface AFetchConfig {
    /** Base URL for all requests */
    baseURL?: string;

    /** Default request headers */
    headers?: Record<string, string>;

    /** Default timeout */
    timeout?: number;

    /** Default response type */
    responseType?: ResponseType;

    /** Default request cache mode */
    cache?: RequestCache;

    /** Default credentials mode */
    credentials?: RequestCredentials;

    /** Default redirect mode */
    redirect?: RequestRedirect;

    /** Default referrer */
    referrer?: string;

    /** Default referrer policy */
    referrerPolicy?: ReferrerPolicy;

    /** Default request transforms */
    transformRequest?: RequestTransform | RequestTransform[];

    /** Default response transforms */
    transformResponse?: ResponseTransform | ResponseTransform[];

    /** Whether to throw on non-2xx status codes by default */
    throwOnError?: boolean;

    /** Custom fetch implementation (defaults to globalThis.fetch) */
    fetchAdapter?: typeof fetch;

    /** Default metadata (plugin config, etc.) */
    meta?: Record<string, unknown>;

    /** Plugins to install */
    plugins?: AFetchPlugin[];
}

/** afetch instance interface */
export interface AFetchInstance {
    /** Make a request */
    request<T = unknown>(url: string, options?: AFetchOptions): Promise<AResponse<T>>;

    /** Make a GET request */
    get<T = unknown>(url: string, options?: AFetchOptions): Promise<AResponse<T>>;

    /** Make a POST request */
    post<T = unknown>(url: string, data?: unknown, options?: AFetchOptions): Promise<AResponse<T>>;

    /** Make a PUT request */
    put<T = unknown>(url: string, data?: unknown, options?: AFetchOptions): Promise<AResponse<T>>;

    /** Make a DELETE request */
    delete<T = unknown>(url: string, options?: AFetchOptions): Promise<AResponse<T>>;

    /** Make a PATCH request */
    patch<T = unknown>(url: string, data?: unknown, options?: AFetchOptions): Promise<AResponse<T>>;

    /** Make a HEAD request */
    head<T = unknown>(url: string, options?: AFetchOptions): Promise<AResponse<T>>;

    /** Make an OPTIONS request */
    options<T = unknown>(url: string, options?: AFetchOptions): Promise<AResponse<T>>;

    /** Create a new afetch instance with merged config */
    create(config?: AFetchConfig): AFetchInstance;

    /** Install a plugin */
    use(plugin: AFetchPlugin): void;

    /** Task API for cancellable requests */
    task: AFetchTask;

    /** Default configuration */
    defaults: AFetchConfig;
}

/** Error type codes */
export enum AFetchErrorType {
    TIMEOUT = 'ETIMEDOUT',
    NETWORK = 'ENETWORK',
    ABORT = 'EABORT',
    HTTP = 'EHTTP',
    PARSE = 'EPARSE',
    CONFIG = 'ECONFIG',
}

/** afetch error class */
export interface AFetchError extends Error {
    /** Error type code */
    code: AFetchErrorType;

    /** The request config that caused the error */
    config: ResolvedRequestConfig;

    /** The response (if available) */
    response?: AResponse;

    /** The original error cause */
    cause?: Error;

    /** HTTP status code (if HTTP error) */
    status?: number;
}

/** Request task for cancellable requests */
export interface RequestTask<T = unknown> {
    /** Abort/cancel the request */
    abort(): void;
    /** Wait for the response. Throws AFetchError with ABORT code if cancelled. */
    wait(): Promise<AResponse<T>>;
    /** Whether the request has been aborted */
    readonly aborted: boolean;
    /** Whether the request has completed */
    readonly done: boolean;
}

/** Task API for creating cancellable requests */
export interface AFetchTask {
    /** Create a cancellable GET task */
    get<T = unknown>(url: string, options?: AFetchOptions): RequestTask<T>;
    /** Create a cancellable POST task */
    post<T = unknown>(url: string, data?: unknown, options?: AFetchOptions): RequestTask<T>;
    /** Create a cancellable PUT task */
    put<T = unknown>(url: string, data?: unknown, options?: AFetchOptions): RequestTask<T>;
    /** Create a cancellable DELETE task */
    delete<T = unknown>(url: string, options?: AFetchOptions): RequestTask<T>;
    /** Create a cancellable PATCH task */
    patch<T = unknown>(url: string, data?: unknown, options?: AFetchOptions): RequestTask<T>;
    /** Create a cancellable HEAD task */
    head<T = unknown>(url: string, options?: AFetchOptions): RequestTask<T>;
    /** Create a cancellable OPTIONS task */
    options<T = unknown>(url: string, options?: AFetchOptions): RequestTask<T>;
}

/** Concurrency helper types */
export type AFetchAllItem<T> = Promise<AResponse<T>> | AResponse<T>;

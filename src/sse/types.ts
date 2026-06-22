/**
 * SSE Types
 * Type definitions for the sse (Server-Sent Events) module
 */

import type { SSEPlugin } from './plugin.js';

/** SSE connection configuration */
export interface SSEConfig {
    /** Base URL to prepend to the URL */
    baseURL?: string;

    /** Request headers */
    headers?: Record<string, string>;

    /** Query parameters */
    params?: Record<string, string | number | boolean | undefined | null>;

    /** Whether to automatically reconnect on connection loss (default: true) */
    autoReconnect?: boolean;

    /** Maximum number of reconnect attempts (default: Infinity) */
    maxReconnectAttempts?: number;

    /** Reconnect delay in ms, or a function returning delay based on attempt number */
    reconnectDelay?: number | ((attempt: number) => number);

    /** Custom fetch implementation (defaults to globalThis.fetch) */
    fetchAdapter?: typeof fetch;

    /** Plugins to install */
    plugins?: SSEPlugin[];

    /** Custom metadata (for plugins) */
    meta?: Record<string, unknown>;
}

/** Parsed SSE event */
export interface SSEEvent {
    /** Event type (from event: field, defaults to 'message') */
    event: string;

    /** Event data */
    data: string;

    /** Event ID (from id: field) */
    id: string;

    /** Retry interval in ms (from retry: field) */
    retry?: number;
}

/** SSE connection state */
export enum SSEState {
    CONNECTING = 'connecting',
    OPEN = 'open',
    CLOSED = 'closed',
}

/** SSE client interface */
export interface SSEClient {
    /** Current connection state */
    readonly state: SSEState;

    /** The resolved full URL */
    readonly url: string;

    /** Number of times the connection has reconnected */
    readonly reconnectCount: number;

    /** Start the SSE connection */
    connect(): void;

    /** Close the SSE connection */
    close(): void;

    /** Install a plugin */
    use(plugin: SSEPlugin): void;

    /** Default configuration (read-only reference) */
    readonly defaults: SSEConfig;
}

/** SSE error types */
export enum SSEErrorType {
    NETWORK = 'SSE_NETWORK',
    PARSE = 'SSE_PARSE',
    TIMEOUT = 'SSE_TIMEOUT',
    CONFIG = 'SSE_CONFIG',
}

/** SSE error class */
export interface SSEError extends Error {
    readonly code: SSEErrorType;
    readonly config: SSEConfig;
    readonly cause?: Error;
}

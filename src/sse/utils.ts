/**
 * SSE Utilities
 * Helper functions for the SSE module
 */

import type { SSEConfig, SSEEvent } from './types.js';

/** Default configuration values */
export const DEFAULT_SSE_CONFIG: Pick<
    Required<SSEConfig>,
    'autoReconnect' | 'maxReconnectAttempts' | 'reconnectDelay'
> = {
    autoReconnect: true,
    maxReconnectAttempts: Infinity,
    reconnectDelay: 3000,
};

/**
 * Build a full URL from baseURL, url, and params
 */
export function buildSSEURL(
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
    const basePart = parts[0];

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
        }
    }

    const queryString = searchParams.toString();
    if (queryString) {
        const separator = basePart.includes('?') ? '&' : '?';
        return `${basePart}${separator}${queryString}${hash}`;
    }

    return fullURL + hash;
}

/**
 * Check if a URL is absolute
 */
function isAbsoluteURL(url: string): boolean {
    return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

/**
 * Join a base URL and a relative URL
 */
function joinURL(baseURL: string, relativeURL: string): string {
    const base = baseURL.replace(/\/+$/, '');
    const relative = relativeURL.replace(/^\/+/, '');
    return `${base}/${relative}`;
}

/**
 * Resolve value with fallback: options > fallback
 */
function resolveValue<T>(val: T | undefined | null, fallback: T): T {
    if (val !== undefined && val !== null) {
        return val;
    }
    return fallback;
}

/**
 * Merge SSE config with defaults
 */
export function mergeSSEConfig(defaults: SSEConfig, options: SSEConfig): SSEConfig {
    return {
        baseURL: resolveValue(options.baseURL, defaults.baseURL),
        headers: { ...defaults.headers, ...options.headers },
        params: resolveValue(options.params, defaults.params),
        autoReconnect: resolveValue(
            options.autoReconnect,
            resolveValue(defaults.autoReconnect, DEFAULT_SSE_CONFIG.autoReconnect)
        ),
        maxReconnectAttempts: resolveValue(
            options.maxReconnectAttempts,
            resolveValue(defaults.maxReconnectAttempts, DEFAULT_SSE_CONFIG.maxReconnectAttempts)
        ),
        reconnectDelay: resolveValue(
            options.reconnectDelay,
            resolveValue(defaults.reconnectDelay, DEFAULT_SSE_CONFIG.reconnectDelay)
        ),
        fetchAdapter: resolveValue(options.fetchAdapter, defaults.fetchAdapter),
        plugins: options.plugins,
        meta: { ...defaults.meta, ...options.meta },
    };
}

/**
 * Calculate reconnect delay from config
 */
export function getReconnectDelay(
    delay: number | ((attempt: number) => number),
    attempt: number
): number {
    if (typeof delay === 'function') {
        return delay(attempt);
    }
    return delay;
}

/**
 * Extract a fallback error message from an unknown error value
 */
export function getSSEErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) {
        return err.message;
    }
    return fallback;
}

/**
 * Parse SSE text data into structured events.
 * Handles multi-line data, event type, id, and retry fields.
 *
 * Only complete events (terminated by \\n\\n) are parsed.
 * Any trailing incomplete event data is left in the buffer.
 * Returns the parsed events and the remaining buffer.
 */
export function parseSSEChunk(chunk: string): { events: SSEEvent[]; remaining: string } {
    const events: SSEEvent[] = [];

    // Normalize line endings: \r\n or \r -> \n
    const normalized = chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split on double newline to get complete events + trailing partial
    const parts = normalized.split('\n\n');

    // All parts except the last are complete events
    for (let i = 0; i < parts.length - 1; i++) {
        const event = parseSSEEventBlock(parts[i]);
        if (event) {
            events.push(event);
        }
    }

    // The last part is either empty (chunk ended with \n\n) or a partial event
    const remaining = parts[parts.length - 1];

    return { events, remaining };
}

/**
 * Parse a single SSE event block (lines separated by \\n, no trailing \\n\\n)
 */
function parseSSEEventBlock(block: string): SSEEvent | null {
    const lines = block.split('\n');
    let event: SSEEvent = { event: 'message', data: '', id: '' };
    let dataLines: string[] = [];
    let hasData = false;

    for (const line of lines) {
        // Comment line (starts with :)
        if (line.startsWith(':')) {
            continue;
        }

        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) {
            // Field with no colon - ignore
            continue;
        }

        const field = line.slice(0, colonIndex);
        let value = line.slice(colonIndex + 1);
        // Remove leading space
        if (value.startsWith(' ')) {
            value = value.slice(1);
        }

        switch (field) {
            case 'event':
                event.event = value || 'message';
                break;
            case 'data':
                dataLines.push(value);
                hasData = true;
                break;
            case 'id':
                event.id = value;
                break;
            case 'retry':
                const retryMs = parseInt(value, 10);
                if (!isNaN(retryMs)) {
                    event.retry = retryMs;
                }
                break;
        }
    }

    if (!hasData) {
        return null;
    }

    event.data = dataLines.join('\n');
    return event;
}

/**
 * aws - WebSocket Utilities
 * Helper functions for the WebSocket module
 */

import type { WSConfig } from './types.js';

// ─── Defaults ─────────────────────────────────────────────────

export const DEFAULT_WS_CONFIG = {
    autoReconnect: true as boolean,
    maxReconnectAttempts: Infinity as number,
    reconnectDelay: 3000 as number,
    autoParse: true as boolean,
    timeout: 10000 as number,
    heartbeatInterval: 0 as number,
};

// ─── URL builder ──────────────────────────────────────────────

/**
 * Build a WebSocket URL from baseURL, path, and query params
 */
export function buildWSURL(
    baseURL: string,
    url: string,
    params?: Record<string, string | number | boolean | null | undefined>
): string {
    // Validate that at least url or baseURL is provided
    if (!url && !baseURL) {
        return '';
    }

    // Resolve full URL
    let fullURL: string;
    try {
        fullURL = new URL(url, baseURL || 'ws://localhost').href;
    } catch {
        if (baseURL && !url.startsWith('ws://') && !url.startsWith('wss://')) {
            fullURL = `${baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
        } else {
            fullURL = url;
        }
    }

    // Preserve hash fragment
    let hash = '';
    const hashIndex = fullURL.indexOf('#');
    if (hashIndex !== -1) {
        hash = fullURL.slice(hashIndex);
        fullURL = fullURL.slice(0, hashIndex);
    }

    // Append query params
    if (params) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== null && value !== undefined) {
                searchParams.append(key, String(value));
            }
        }
        const qs = searchParams.toString();
        if (qs) {
            fullURL += (fullURL.includes('?') ? '&' : '?') + qs;
        }
    }

    return fullURL + hash;
}

// ─── Config merger ────────────────────────────────────────────

/**
 * Merge user config with instance defaults
 */
export function mergeWSConfig(defaults: WSConfig, config: WSConfig = {}): WSConfig {
    const merged: WSConfig = { ...defaults, ...config };

    // Deep merge headers-like objects
    if (defaults.meta || config.meta) {
        merged.meta = { ...defaults.meta, ...config.meta };
    }

    return merged;
}

// ─── Reconnect delay resolver ─────────────────────────────────

/**
 * Resolve reconnect delay from config (static number or function)
 */
export function getReconnectDelay(config: WSConfig, attempt: number): number {
    const delay = config.reconnectDelay;
    if (typeof delay === 'function') {
        return delay(attempt);
    }
    if (typeof delay === 'number') {
        return delay;
    }
    return DEFAULT_WS_CONFIG.reconnectDelay;
}

// ─── Error message extractor ──────────────────────────────────

/**
 * Extract a message from an unknown error
 */
export function getWSErrorMessage(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}

// ─── JSON serializer ──────────────────────────────────────────

/**
 * Serialize data for WebSocket send.
 * Objects are JSON-stringified, strings/ArrayBuffer/Blob pass through.
 */
export function serializeWSMessage(
    data: string | ArrayBuffer | Blob | object
): string | ArrayBuffer | Blob {
    if (typeof data === 'object' && !(data instanceof ArrayBuffer) && !(data instanceof Blob)) {
        return JSON.stringify(data);
    }
    return data;
}

// ─── JSON parser ──────────────────────────────────────────────

/**
 * Try to parse a message as JSON. Returns the raw string on failure.
 */
export function parseWSMessage(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
}

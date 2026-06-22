/**
 * aws - WebSocket Types
 * Type definitions for the WebSocket module
 */

// ─── State ────────────────────────────────────────────────────

export enum WSState {
    /** Not connected */
    CLOSED = 'CLOSED',
    /** Connecting to the server */
    CONNECTING = 'CONNECTING',
    /** Connected and ready to send/receive */
    OPEN = 'OPEN',
    /** Connection is closing */
    CLOSING = 'CLOSING',
}

// ─── Error types ──────────────────────────────────────────────

export enum WSErrorType {
    /** URL or configuration error */
    CONFIG = 'WS_CONFIG',
    /** Connection failed or lost */
    NETWORK = 'WS_NETWORK',
    /** Message parse/serialization error */
    PARSE = 'WS_PARSE',
    /** Send timeout */
    TIMEOUT = 'WS_TIMEOUT',
}

// ─── Message ──────────────────────────────────────────────────

export interface WSMessage {
    /** Message data (parsed if autoParse is enabled) */
    data: unknown;
    /** Raw message data string */
    raw: string;
    /** Origin of the message event */
    origin?: string;
    /** Timestamp when the message was received */
    timestamp: number;
}

// ─── Configuration ────────────────────────────────────────────

export interface WSConfig {
    /** Base URL (e.g., 'wss://api.example.com') */
    baseURL?: string;
    /** WebSocket protocols */
    protocols?: string | string[];
    /** Auto-reconnect on unexpected close */
    autoReconnect?: boolean;
    /** Maximum reconnect attempts */
    maxReconnectAttempts?: number;
    /** Reconnect delay in ms (static or function of attempt number) */
    reconnectDelay?: number | ((attempt: number) => number);
    /** Query parameters */
    params?: Record<string, string | number | boolean | null | undefined>;
    /** Auto-parse JSON messages */
    autoParse?: boolean;
    /** Custom WebSocket implementation (for testing/mocking) */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webSocketImpl?: any;
    /** Plugins to install at creation */
    plugins?: WSPlugin[];
    /** Arbitrary metadata for plugins */
    meta?: Record<string, unknown>;
    /** Connection timeout in ms */
    timeout?: number;
    /** Heartbeat interval in ms */
    heartbeatInterval?: number;
    /** Heartbeat message to send (string or function returning string/data) */
    heartbeatMessage?: string | (() => string | ArrayBuffer | Blob);
    /** Binary type for the WebSocket */
    binaryType?: BinaryType;
}

// ─── Client interface ─────────────────────────────────────────

export interface WSClient {
    /** Current connection state */
    readonly state: WSState;
    /** Full URL being connected to */
    readonly url: string;
    /** Number of successful reconnections */
    readonly reconnectCount: number;
    /** Current configuration (readonly) */
    readonly defaults: Readonly<WSConfig>;

    /** Open the WebSocket connection */
    connect(): void;
    /** Close the WebSocket connection */
    close(code?: number, reason?: string): void;
    /** Send data through the WebSocket */
    send(data: string | ArrayBuffer | Blob | object): void;
    /** Install a plugin */
    use(plugin: WSPlugin): void;

    /** @internal Test-only: expose tryReconnect for branch coverage */
    _tryReconnect?: (config?: WSConfig) => void;
}

// ─── Re-exports for plugin ────────────────────────────────────

import type { WSPlugin } from './plugin.js';

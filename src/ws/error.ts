/**
 * aws - WebSocket Error
 * Custom error class for the WebSocket module
 */

import type { WSConfig } from './types.js';
import { WSErrorType } from './types.js';

export class WSError extends Error {
    readonly code: WSErrorType;
    readonly config: WSConfig;
    readonly cause?: Error;

    constructor(message: string, code: WSErrorType, config: WSConfig, cause?: Error) {
        super(message);
        this.name = 'WSError';
        this.code = code;
        this.config = config;
        this.cause = cause;

        // Restore prototype chain for instanceof checks
        Object.setPrototypeOf(this, WSError.prototype);
    }

    /** Whether the error is a configuration error */
    get isConfigError(): boolean {
        return this.code === WSErrorType.CONFIG;
    }

    /** Whether the error is a network/connection error */
    get isNetworkError(): boolean {
        return this.code === WSErrorType.NETWORK;
    }

    /** Whether the error is a parse/serialization error */
    get isParseError(): boolean {
        return this.code === WSErrorType.PARSE;
    }

    /** Whether the error is a timeout error */
    get isTimeout(): boolean {
        return this.code === WSErrorType.TIMEOUT;
    }

    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            url: this.config.baseURL || 'unknown',
        };
    }
}

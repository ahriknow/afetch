/**
 * SSE Error
 * Custom error class for sse
 */

import { SSEErrorType } from './types.js';
import type { SSEConfig } from './types.js';

/**
 * Custom error class for SSE operations
 */
export class SSEError extends Error {
    /** Error type code */
    public readonly code: SSEErrorType;

    /** The SSE config that caused the error */
    public readonly config: SSEConfig;

    /** The original error cause */
    public override readonly cause?: Error;

    constructor(message: string, code: SSEErrorType, config: SSEConfig, cause?: Error) {
        super(message);
        this.name = 'SSEError';
        this.code = code;
        this.config = config;
        this.cause = cause;

        // Maintain proper prototype chain
        Object.setPrototypeOf(this, new.target.prototype);
    }

    /** Check if this error is a network error */
    get isNetworkError(): boolean {
        return this.code === SSEErrorType.NETWORK;
    }

    /** Check if this error is a parse error */
    get isParseError(): boolean {
        return this.code === SSEErrorType.PARSE;
    }

    /** Check if this error is a timeout error */
    get isTimeout(): boolean {
        return this.code === SSEErrorType.TIMEOUT;
    }

    /** Check if this error is a config error */
    get isConfigError(): boolean {
        return this.code === SSEErrorType.CONFIG;
    }

    /** Serialize error to a plain object for logging/debugging */
    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            url: this.config.baseURL,
        };
    }
}

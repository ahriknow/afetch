/**
 * afetch - Error
 * Custom error class for afetch
 */

import type { AResponse, ResolvedRequestConfig } from './types.js';
import { AFetchErrorType } from './types.js';

/**
 * Custom error class for afetch operations
 */
export class AFetchError extends Error {
    /** Error type code */
    public readonly code: AFetchErrorType;

    /** The request config that caused the error */
    public readonly config: ResolvedRequestConfig;

    /** The response (if available) */
    public readonly response?: AResponse;

    /** The original error cause */
    public override readonly cause?: Error;

    /** HTTP status code (if HTTP error) */
    public readonly status?: number;

    constructor(
        message: string,
        code: AFetchErrorType,
        config: ResolvedRequestConfig,
        response?: AResponse,
        cause?: Error
    ) {
        super(message);
        this.name = 'AFetchError';
        this.code = code;
        this.config = config;
        this.response = response;
        this.cause = cause;
        this.status = response?.status;

        // Maintain proper prototype chain
        Object.setPrototypeOf(this, new.target.prototype);
    }

    /**
     * Check if this error is a timeout error
     */
    get isTimeout(): boolean {
        return this.code === AFetchErrorType.TIMEOUT;
    }

    /**
     * Check if this error is a network error
     */
    get isNetworkError(): boolean {
        return this.code === AFetchErrorType.NETWORK;
    }

    /**
     * Check if this error is an abort error
     */
    get isAbort(): boolean {
        return this.code === AFetchErrorType.ABORT;
    }

    /**
     * Check if this error is an HTTP error
     */
    get isHttpError(): boolean {
        return this.code === AFetchErrorType.HTTP;
    }

    /**
     * Check if this error is a parse error
     */
    get isParseError(): boolean {
        return this.code === AFetchErrorType.PARSE;
    }

    /**
     * Serialize error to a plain object for logging/debugging
     */
    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            status: this.status,
            url: this.config.url,
            method: this.config.method,
        };
    }
}

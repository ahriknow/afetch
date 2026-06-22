/**
 * SSE Module Index
 * Server-Sent Events client module
 *
 * @packageDocumentation
 */

export { createSSE } from './asse.js';
export { SSEError } from './error.js';
export { SSEState, SSEErrorType } from './types.js';

export type { SSEConfig, SSEEvent, SSEClient, SSEError as SSEErrorType2 } from './types.js';

export type {
    SSEPlugin,
    SSEPluginApi,
    SSEConnectHook,
    SSEMessageHook,
    SSEErrorHook,
    SSECloseHook,
    SSEConnectContext,
    SSEMessageContext,
    SSEErrorContext,
    SSECloseContext,
} from './plugin.js';

export { createAutoReconnectPlugin } from './plugins/index.js';
export type { AutoReconnectOptions } from './plugins/index.js';

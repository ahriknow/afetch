/**
 * aws - Plugins Index
 * Barrel export for built-in plugins
 */

export { createAutoReconnectPlugin } from './auto-reconnect.js';
export type { AutoReconnectOptions } from './auto-reconnect.js';

export { createRequestSyncPlugin } from './request-sync.js';
export type {
    RequestSyncPlugin,
    RequestSyncOptions,
    IdType,
    IdGenerator,
    RequestFormatter,
    ResponseIdExtractor,
    ResponseMatcher,
    ResponseDataExtractor,
} from './request-sync.js';

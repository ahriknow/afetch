/**
 * afetch - A lightweight, type-safe fetch API wrapper
 *
 * @packageDocumentation
 */

// Core exports
export { afetch, createInstance } from './afetch.js';

// Error exports
export { AFetchError } from './error.js';

// Type exports
export { AFetchErrorType } from './types.js';
export type {
    HttpMethod,
    ResponseType,
    RequestTransform,
    ResponseTransform,
    ProgressCallback,
    AFetchOptions,
    ResolvedRequestConfig,
    AResponse,
    AFetchConfig,
    AFetchInstance,
    AFetchAllItem,
    RetryOnConfig,
    RequestTask,
    AFetchTask,
} from './types.js';

// Plugin system exports
export type {
    AFetchPlugin,
    AFetchPluginApi,
    BeforeRequestHook,
    AfterResponseHook,
    OnErrorHook,
} from './plugin.js';

// Default plugins
export {
    createRetryPlugin,
    createEventBusPlugin,
    createQueuePlugin,
    RequestQueue,
    createCachePlugin,
    ResponseCache,
} from './plugins/index.js';
export type { RetryOptions, QueueOptions, QueuePlugin, CacheOptions } from './plugins/index.js';
export type {
    RequestEventData,
    ResponseEventData,
    ErrorEventData,
    EventBusPlugin,
} from './plugins/index.js';

// Event emitter
export { Emitter } from './events.js';

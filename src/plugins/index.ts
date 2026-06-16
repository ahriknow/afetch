/**
 * afetch - Default Plugins
 */

export { createRetryPlugin } from './retry.js';
export type { RetryOptions } from './retry.js';
export { createEventBusPlugin } from './event-bus.js';
export type {
    RequestEventData,
    ResponseEventData,
    ErrorEventData,
    EventBusPlugin,
} from './event-bus.js';
export { createQueuePlugin, RequestQueue } from './queue.js';
export type { QueueOptions, QueuePlugin } from './queue.js';
export { createCachePlugin, ResponseCache } from './cache.js';
export type { CacheOptions, CacheDecision } from './cache.js';

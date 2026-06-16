/**
 * afetch - Queue Plugin
 * Controls concurrent request execution automatically via plugin hooks.
 * Install the plugin and all requests are automatically concurrency-limited.
 *
 * @example
 * ```typescript
 * const queuePlugin = createQueuePlugin({ maxConcurrent: 3 });
 * api.use(queuePlugin);
 *
 * // Just use the API normally — concurrency is controlled automatically
 * const responses = await Promise.all(urls.map(url => api.get(url)));
 *
 * console.log(queuePlugin.pending); // 0
 * console.log(queuePlugin.queued);  // 0
 * ```
 */

import type { AFetchPlugin, AFetchPluginApi } from '../plugin.js';

export interface QueueOptions {
    /** Maximum concurrent requests (default: 6) */
    maxConcurrent?: number;
}

interface Waiter {
    resolve: () => void;
    reject: (err: Error) => void;
}

export interface QueuePlugin extends AFetchPlugin {
    /** Number of currently running requests */
    readonly pending: number;
    /** Number of queued requests waiting for a slot */
    readonly queued: number;
    /** Clear the queue and reject all waiting items */
    clear(): void;
}

/**
 * Create a queue plugin that automatically controls request concurrency
 * via the plugin hook system. No need to wrap requests — just `api.use()`
 * and all requests are concurrency-limited.
 */
export function createQueuePlugin(options: QueueOptions = {}): QueuePlugin {
    const maxConcurrent = options.maxConcurrent ?? 6;
    let running = 0;
    const waiters: Waiter[] = [];

    function acquire(): void | Promise<void> {
        if (running < maxConcurrent) {
            running++;
            return;
        }
        return new Promise<void>((resolve, reject) => {
            waiters.push({ resolve, reject });
        });
    }

    function release(): void {
        running--;
        const next = waiters.shift();
        if (next) {
            running++;
            next.resolve();
        }
    }

    const plugin: QueuePlugin = {
        name: 'queue',

        get pending() {
            return running;
        },

        get queued() {
            return waiters.length;
        },

        clear(): void {
            const items = waiters.splice(0);
            for (const item of items) {
                item.reject(new Error('Queue cleared'));
            }
        },

        install(api: AFetchPluginApi): void {
            api.addHook('beforeRequest', () => {
                return acquire();
            });

            api.addHook('afterResponse', () => {
                release();
            });

            api.addHook('onError', () => {
                release();
            });
        },
    };

    return plugin;
}

/**
 * Standalone request queue for concurrency control
 *
 * @example
 * ```typescript
 * const queue = new RequestQueue(3);
 * const responses = await Promise.all(
 *   urls.map(url => queue.run(() => api.get(url)))
 * );
 * ```
 */
interface QueueItem {
    fn: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
}

export class RequestQueue {
    private running = 0;
    private queue: QueueItem[] = [];

    constructor(private maxConcurrent: number = 6) {}

    /**
     * Enqueue a request function for concurrent-limited execution
     */
    async run<T>(fn: () => Promise<T>): Promise<T> {
        if (this.running >= this.maxConcurrent) {
            await new Promise<void>((resolve, reject) => {
                this.queue.push({
                    fn: fn as () => Promise<unknown>,
                    resolve: resolve as (value: unknown) => void,
                    reject,
                });
            });
        }

        this.running++;
        try {
            return await fn();
        } finally {
            this.running--;
            if (this.queue.length > 0) {
                const next = this.queue.shift();
                if (next) {
                    next.resolve(undefined);
                }
            }
        }
    }

    /** Number of currently running requests */
    get pending(): number {
        return this.running;
    }

    /** Number of queued requests waiting */
    get queued(): number {
        return this.queue.length;
    }

    /** Clear the queue and reject all waiting items */
    clear(): void {
        for (const item of this.queue) {
            item.reject(new Error('Queue cleared'));
        }
        this.queue.length = 0;
    }
}

/**
 * afetch - Event Bus Plugin
 * Emits events for request lifecycle: request, response, error
 */

import type { ResolvedRequestConfig, AResponse } from '../types.js';
import type { AFetchPlugin, AFetchPluginApi } from '../plugin.js';
import type { AFetchError } from '../error.js';
import { Emitter } from '../events.js';

// ─── Event data types ──────────────────────────────────────────

export interface RequestEventData {
    config: ResolvedRequestConfig;
}

export interface ResponseEventData {
    config: ResolvedRequestConfig;
    response: AResponse;
}

export interface ErrorEventData {
    config: ResolvedRequestConfig;
    error: AFetchError;
}

// ─── EventBus plugin type (includes on/off) ────────────────────

export interface EventBusPlugin extends AFetchPlugin {
    on: {
        (event: 'request', listener: (data: RequestEventData) => void): () => void;
        (event: 'response', listener: (data: ResponseEventData) => void): () => void;
        (event: 'error', listener: (data: ErrorEventData) => void): () => void;
    };
    off: (event?: string) => void;
}

// ─── Plugin factory ────────────────────────────────────────────

export function createEventBusPlugin(): EventBusPlugin {
    const emitter = new Emitter();

    const plugin: EventBusPlugin = {
        name: 'event-bus',

        on: ((event: string, listener: (data: unknown) => void) =>
            emitter.on(event, listener)) as EventBusPlugin['on'],
        off: (event?: string) => emitter.off(event),

        install(api: AFetchPluginApi): void {
            api.addHook('beforeRequest', ({ config }) => {
                emitter.emit('request', { config });
            });

            api.addHook('afterResponse', ({ config, response }) => {
                emitter.emit('response', { config, response });
            });

            api.addHook('onError', ({ config, error }) => {
                emitter.emit('error', { config, error });
            });
        },
    };

    return plugin;
}

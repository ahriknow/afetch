/**
 * afetch - Event Bus Plugin Example
 */

import { createInstance, createEventBusPlugin } from '../src/index.js';
import type { EventBusPlugin } from '../src/index.js';

// ─── Example 1: Basic event listening ──────────────────────────

async function basicEventBus() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    const eventBus: EventBusPlugin = createEventBusPlugin();
    api.use(eventBus);

    // Listen to request events
    eventBus.on('request', ({ config }) => {
        console.log(`→ ${config.method} ${config.url}`);
    });

    // Listen to response events
    eventBus.on('response', ({ config, response }) => {
        console.log(`← ${response.status} ${config.url}`);
    });

    // Listen to error events
    eventBus.on('error', ({ config, error }) => {
        console.error(`✗ ${error.code} ${config.url}`);
    });

    await api.get('/users');
}

// ─── Example 2: Unsubscribe from events ────────────────────────

async function unsubscribeExample() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    const eventBus: EventBusPlugin = createEventBusPlugin();
    api.use(eventBus);

    // Subscribe to request events
    const unsub = eventBus.on('request', ({ config }) => {
        console.log(`→ ${config.method} ${config.url}`);
    });

    await api.get('/users/1');

    // Unsubscribe from request events
    unsub();

    // This request won't trigger the request listener
    await api.get('/users/2');
}

// ─── Example 3: Remove all listeners for an event ──────────────

async function offExample() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    const eventBus: EventBusPlugin = createEventBusPlugin();
    api.use(eventBus);

    eventBus.on('response', ({ response }) => {
        console.log(`Status: ${response.status}`);
    });

    await api.get('/users/1');

    // Remove all response listeners
    eventBus.off('response');

    // This request won't trigger the response listener
    await api.get('/users/2');
}

// ─── Example 4: Remove all listeners ───────────────────────────

async function offAllExample() {
    const api = createInstance({
        baseURL: 'https://jsonplaceholder.typicode.com',
    });

    const eventBus: EventBusPlugin = createEventBusPlugin();
    api.use(eventBus);

    eventBus.on('request', () => console.log('request'));
    eventBus.on('response', () => console.log('response'));
    eventBus.on('error', () => console.log('error'));

    await api.get('/users/1');

    // Remove all listeners for all events
    eventBus.off();

    // No listeners will be triggered
    await api.get('/users/2');
}

// ─── Run examples ──────────────────────────────────────────────

async function main() {
    console.log('=== Basic Event Bus ===');
    await basicEventBus();

    console.log('\n=== Unsubscribe ===');
    await unsubscribeExample();

    console.log('\n=== Off Specific Event ===');
    await offExample();

    console.log('\n=== Off All Events ===');
    await offAllExample();
}

main().catch(console.error);

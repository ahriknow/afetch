# SSE (Server-Sent Events)

[← Back to README](../../README.md)

The SSE module provides a type-safe Server-Sent Events client with a plugin system. It is an independent sub-module that does not affect the core `afetch` bundle — only import it when you need SSE functionality.

```typescript
import { createSSE } from '@ahriknow/afetch/sse';
```

## Quick Start

```typescript
import { createSSE } from '@ahriknow/afetch/sse';

const sse = createSSE('https://api.example.com/events');

// Listen for messages
sse.use({
    name: 'logger',
    install(api) {
        api.addHook('message', ({ event }) => {
            console.log(`[${event.event || 'message'}]`, event.data);
        });
    },
});

sse.connect();
```

## Configuration

```typescript
const sse = createSSE('/events', {
    baseURL: 'https://api.example.com',
    headers: { Authorization: 'Bearer token' },
    params: { stream: 'true' },
    autoReconnect: true,
    maxReconnectAttempts: 10,
    reconnectDelay: 3000,
    // Or use a function for exponential backoff:
    // reconnectDelay: (attempt) => Math.pow(2, attempt) * 1000,
    fetchAdapter: customFetch,
    plugins: [createAutoReconnectPlugin()],
    meta: { source: 'dashboard' },
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseURL` | `string` | — | Base URL prepended to relative URLs |
| `headers` | `Record<string, string>` | `{ Accept: 'text/event-stream', 'Cache-Control': 'no-cache' }` | Custom HTTP headers |
| `params` | `Record<string, string \| number \| boolean \| null \| undefined>` | — | Query parameters (null/undefined values are omitted) |
| `autoReconnect` | `boolean` | `true` | Enable automatic reconnection |
| `maxReconnectAttempts` | `number` | `Infinity` | Maximum number of reconnect attempts |
| `reconnectDelay` | `number \| (attempt: number) => number` | `3000` | Delay between reconnects (ms), can be a static number or function |
| `fetchAdapter` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation |
| `plugins` | `SSEPlugin[]` | — | Plugins to install at creation |
| `meta` | `Record<string, unknown>` | — | Arbitrary metadata for plugins |

## Client API

### `sse.connect()`

Opens the SSE connection. If already connected, this is a no-op.

```typescript
sse.connect();
```

### `sse.close()`

Closes the connection and stops any pending reconnects. Fires `close` hooks.

```typescript
sse.close();
```

### `sse.use(plugin)`

Installs a plugin. Plugins with the same name are only installed once.

```typescript
sse.use(myPlugin);
```

### Readonly Properties

| Property | Type | Description |
|----------|------|-------------|
| `sse.state` | `SSEState` | Current connection state: `CONNECTING`, `OPEN`, or `CLOSED` |
| `sse.url` | `string` | Full URL being connected to |
| `sse.reconnectCount` | `number` | Number of successful reconnections |
| `sse.defaults` | `SSEConfig` | Current configuration (readonly) |

## State Management

The SSE client manages three states:

```typescript
import { SSEState } from '@ahriknow/afetch/sse';

console.log(sse.state); // SSEState.CLOSED
sse.connect();          // → SSEState.CONNECTING → SSEState.OPEN
sse.close();            // → SSEState.CLOSED
```

- `CLOSED` — Not connected (initial state, or after `close()`)
- `CONNECTING` — Establishing connection
- `OPEN` — Connection established, receiving events

## Error Handling

The SSE module throws `SSEError` instances:

```typescript
import { SSEError, SSEErrorType } from '@ahriknow/afetch/sse';

sse.use({
    name: 'error-handler',
    install(api) {
        api.addHook('error', ({ error, attempt, config }) => {
            if (error.isNetworkError) {
                console.log(`Network error on attempt ${attempt + 1}`);
            }
            if (error.isConfigError) {
                console.error('Invalid configuration:', error.message);
                return false; // prevent reconnect
            }
            // Return void/undefined to allow reconnection
        });
    },
});
```

### Error Types

| Code | Description |
|------|-------------|
| `SSEErrorType.NETWORK` | Network or HTTP error (non-OK status, fetch failure, abort) |
| `SSEErrorType.PARSE` | SSE data parsing error |
| `SSEErrorType.TIMEOUT` | Connection timeout |
| `SSEErrorType.CONFIG` | Configuration error (e.g., missing URL) |

### `SSEError` Properties

| Property | Type | Description |
|----------|------|-------------|
| `code` | `SSEErrorType` | Error type code |
| `config` | `SSEConfig` | Configuration at time of error |
| `cause` | `Error \| undefined` | Original error that caused this |
| `isNetworkError` | `boolean` | Shorthand for `code === SSEErrorType.NETWORK` |
| `isParseError` | `boolean` | Shorthand for `code === SSEErrorType.PARSE` |
| `isTimeout` | `boolean` | Shorthand for `code === SSEErrorType.TIMEOUT` |
| `isConfigError` | `boolean` | Shorthand for `code === SSEErrorType.CONFIG` |

## Plugin System

The SSE module has its own plugin system, independent of the core `afetch` plugin system.

### Plugin Interface

```typescript
import type { SSEPlugin } from '@ahriknow/afetch/sse';

const myPlugin: SSEPlugin = {
    name: 'my-plugin',
    install(api) {
        api.addHook('connect', (ctx) => { /* ... */ });
        api.addHook('message', (ctx) => { /* ... */ });
        api.addHook('error', (ctx) => { /* ... */ });
        api.addHook('close', (ctx) => { /* ... */ });
    },
};
```

### Hook Contexts

| Hook | Context | Description |
|------|---------|-------------|
| `connect` | `{ config, url }` | Fired when connection is established |
| `message` | `{ config, event }` | Fired for each parsed SSE event |
| `error` | `{ config, error, attempt }` | Fired on error; return `false` to prevent reconnect |
| `close` | `{ config, reconnectCount }` | Fired when connection is finalized |

### SSE Event Structure

```typescript
interface SSEEvent {
    event?: string;   // Event type (default: 'message')
    data: string;     // Event data
    id?: string;      // Last event ID
    retry?: number;   // Reconnection time in ms
}
```

## Auto-Reconnect Plugin

Built-in plugin for controlling reconnection behavior:

```typescript
import { createAutoReconnectPlugin } from '@ahriknow/afetch/sse';

sse.use(createAutoReconnectPlugin({
    maxAttempts: 5,
    delay: 2000,
    shouldReconnect: (ctx) => {
        // Don't reconnect on 401/403
        if (ctx.error.cause instanceof Response) {
            return ctx.error.cause.status !== 401
                && ctx.error.cause.status !== 403;
        }
        return true;
    },
}));
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxAttempts` | `number` | `undefined` | Maximum reconnect attempts |
| `delay` | `number \| (attempt: number) => number` | `undefined` | Custom reconnect delay |
| `shouldReconnect` | `(ctx: SSEErrorContext) => boolean` | `undefined` | Custom predicate for reconnection decisions |

## Custom Plugins

### Logging Plugin

```typescript
sse.use({
    name: 'sse-logger',
    install(api) {
        api.addHook('connect', ({ url }) => {
            console.log(`[SSE] Connected to ${url}`);
        });
        api.addHook('message', ({ event }) => {
            console.log(`[SSE] ${event.event || 'message'}:`, event.data);
        });
        api.addHook('error', ({ error, attempt }) => {
            console.error(`[SSE] Error (attempt ${attempt + 1}):`, error.message);
        });
        api.addHook('close', ({ reconnectCount }) => {
            console.log(`[SSE] Closed (reconnected ${reconnectCount} times)`);
        });
    },
});
```

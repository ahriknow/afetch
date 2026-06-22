# WebSocket

[← Back to README](../../README.md)

The WebSocket module provides a type-safe WebSocket client with a plugin system. It is an independent sub-module that does not affect the core `afetch` bundle — only import it when you need WebSocket functionality.

```typescript
import { createWS } from '@ahriknow/afetch/ws';
```

## Quick Start

```typescript
import { createWS } from '@ahriknow/afetch/ws';

const ws = createWS('wss://api.example.com/ws');

// Listen for messages
ws.use({
    name: 'logger',
    install(api) {
        api.addHook('open', ({ url }) => {
            console.log(`Connected to ${url}`);
        });
        api.addHook('message', ({ message }) => {
            console.log('Received:', message.data);
        });
        api.addHook('close', ({ code, reason }) => {
            console.log(`Closed: ${code} ${reason}`);
        });
    },
});

ws.connect();

// Send messages
ws.send({ type: 'ping' });
ws.send('Hello server');
```

## Configuration

```typescript
const ws = createWS('/ws', {
    baseURL: 'wss://api.example.com',
    protocols: ['chat', 'v1'],
    autoReconnect: true,
    maxReconnectAttempts: 10,
    reconnectDelay: 3000,
    // Or use a function for exponential backoff:
    // reconnectDelay: (attempt) => Math.pow(2, attempt) * 1000,
    params: { token: 'abc123' },
    autoParse: true,
    timeout: 10000,
    heartbeatInterval: 30000,
    heartbeatMessage: 'ping',
    binaryType: 'arraybuffer',
    plugins: [createAutoReconnectPlugin()],
    meta: { source: 'dashboard' },
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseURL` | `string` | — | Base URL prepended to relative URLs |
| `protocols` | `string \| string[]` | — | WebSocket sub-protocols |
| `autoReconnect` | `boolean` | `true` | Enable automatic reconnection on unexpected close |
| `maxReconnectAttempts` | `number` | `Infinity` | Maximum number of reconnect attempts |
| `reconnectDelay` | `number \| (attempt: number) => number` | `1000` | Delay between reconnects (ms), can be a static number or function |
| `params` | `Record<string, string \| number \| boolean \| null \| undefined>` | — | Query parameters appended to the URL (null/undefined values are omitted) |
| `autoParse` | `boolean` | `false` | Automatically parse JSON messages and serialize sent objects |
| `timeout` | `number` | `10000` | Connection timeout in ms |
| `heartbeatInterval` | `number` | `0` | Heartbeat interval in ms (0 = disabled) |
| `heartbeatMessage` | `string \| (() => string \| ArrayBuffer \| Blob)` | — | Heartbeat message content |
| `binaryType` | `BinaryType` | `'blob'` | Binary type for the WebSocket (`'blob'` or `'arraybuffer'`) |
| `webSocketImpl` | `typeof WebSocket` | `globalThis.WebSocket` | Custom WebSocket implementation (for testing/mocking) |
| `plugins` | `WSPlugin[]` | — | Plugins to install at creation |
| `meta` | `Record<string, unknown>` | — | Arbitrary metadata for plugins |

## Client API

### `ws.connect()`

Opens the WebSocket connection. If already connected or connecting, this is a no-op.

```typescript
ws.connect();
```

### `ws.close(code?, reason?)`

Closes the WebSocket connection and stops any pending reconnects. Fires `close` hooks.

```typescript
ws.close();                          // Default close
ws.close(1000, 'Normal closure');    // With code and reason
```

### `ws.send(data)`

Sends data through the WebSocket. If `autoParse` is enabled, objects are automatically serialized to JSON. Fires `send` hooks before sending.

```typescript
ws.send('Hello');                          // Send string
ws.send(new Uint8Array([1, 2, 3]).buffer); // Send binary
ws.send({ type: 'greeting', text: 'Hi' }); // Send object (autoParse)
```

### `ws.use(plugin)`

Installs a plugin. Plugins with the same name are only installed once.

```typescript
ws.use(myPlugin);
```

### Readonly Properties

| Property | Type | Description |
|----------|------|-------------|
| `ws.state` | `WSState` | Current connection state: `CLOSED`, `CONNECTING`, `OPEN`, or `CLOSING` |
| `ws.url` | `string` | Full URL being connected to |
| `ws.reconnectCount` | `number` | Number of successful reconnections |
| `ws.defaults` | `WSConfig` | Current configuration (readonly) |

## State Management

The WebSocket client manages four states:

```typescript
import { WSState } from '@ahriknow/afetch/ws';

console.log(ws.state); // WSState.CLOSED
ws.connect();          // → WSState.CONNECTING → WSState.OPEN
ws.close();            // → WSState.CLOSING → WSState.CLOSED
```

- `CLOSED` — Not connected (initial state, or after `close()`)
- `CONNECTING` — Establishing connection
- `OPEN` — Connection established, ready to send/receive
- `CLOSING` — Connection is closing

## Error Handling

The WebSocket module throws `WSError` instances:

```typescript
import { WSError, WSErrorType } from '@ahriknow/afetch/ws';

ws.use({
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
            if (error.isTimeout) {
                console.warn('Connection timed out');
            }
            // Return void/undefined to allow reconnection
        });
    },
});
```

### Error Types

| Code | Description |
|------|-------------|
| `WSErrorType.NETWORK` | Connection failed or lost (WebSocket error, unexpected close) |
| `WSErrorType.PARSE` | Message parse or serialization error |
| `WSErrorType.TIMEOUT` | Connection or send timeout |
| `WSErrorType.CONFIG` | Configuration error (e.g., invalid URL) |

### `WSError` Properties

| Property | Type | Description |
|----------|------|-------------|
| `code` | `WSErrorType` | Error type code |
| `config` | `WSConfig` | Configuration at time of error |
| `cause` | `Error \| undefined` | Original error that caused this |
| `isNetworkError` | `boolean` | Shorthand for `code === WSErrorType.NETWORK` |
| `isParseError` | `boolean` | Shorthand for `code === WSErrorType.PARSE` |
| `isTimeout` | `boolean` | Shorthand for `code === WSErrorType.TIMEOUT` |
| `isConfigError` | `boolean` | Shorthand for `code === WSErrorType.CONFIG` |

## Plugin System

The WebSocket module has its own plugin system, independent of the core `afetch` plugin system.

### Plugin Interface

```typescript
import type { WSPlugin } from '@ahriknow/afetch/ws';

const myPlugin: WSPlugin = {
    name: 'my-plugin',
    install(api) {
        api.addHook('open', (ctx) => { /* ... */ });
        api.addHook('message', (ctx) => { /* ... */ });
        api.addHook('error', (ctx) => { /* ... */ });
        api.addHook('close', (ctx) => { /* ... */ });
        api.addHook('send', (ctx) => { /* ... */ });
    },
};
```

### Hook Contexts

| Hook | Context | Description |
|------|---------|-------------|
| `open` | `{ config, url }` | Fired when connection is established |
| `message` | `{ config, message }` | Fired for each received message |
| `error` | `{ config, error, attempt }` | Fired on error; return `false` to prevent reconnect |
| `close` | `{ config, code, reason, reconnectCount, wasClean }` | Fired when connection is finalized |
| `send` | `{ config, data }` | Fired before sending data |

### Message Structure

```typescript
interface WSMessage {
    data: unknown;     // Parsed data (if autoParse enabled)
    raw: string;       // Raw message string
    origin?: string;   // Origin of the message event
    timestamp: number; // Timestamp when received
}
```

## Auto-Reconnect Plugin

Built-in plugin for controlling reconnection behavior:

```typescript
import { createAutoReconnectPlugin } from '@ahriknow/afetch/ws';

ws.use(createAutoReconnectPlugin({
    maxAttempts: 5,
    delay: 2000,
    shouldReconnect: (ctx) => {
        // Don't reconnect on specific close codes
        if (ctx.error.code === 'NETWORK' && ctx.attempt >= 3) {
            return false;
        }
        return true;
    },
}));
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxAttempts` | `number` | `undefined` | Maximum reconnect attempts |
| `delay` | `number \| (attempt: number) => number` | `undefined` | Custom reconnect delay (overrides config) |
| `shouldReconnect` | `(ctx: WSErrorContext) => boolean` | `undefined` | Custom predicate for reconnection decisions |

## Request-Sync Plugin

Built-in plugin for implementing request-response pattern over WebSocket. Assigns unique IDs to outgoing messages and matches incoming responses:

```typescript
import { createWS, createRequestSyncPlugin } from '@ahriknow/afetch/ws';

const ws = createWS('wss://api.example.com/ws');
const sync = createRequestSyncPlugin({
    timeout: 5000,
    idGenerator: () => crypto.randomUUID(),
});

ws.use(sync);

// Send a request and wait for matching response
const response = await sync.request('getUser', { id: 123 });
console.log(response.data); // Response data

// Send without waiting for response
sync.send('notify', { type: 'update' });
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number` | `30000` | Timeout for waiting for a response (ms) |
| `idGenerator` | `() => string` | `createNumericIdGenerator()` | Function to generate unique request IDs |
| `requestFormatter` | `(id, type, payload) => any` | `undefined` | Custom request message format |
| `responseIdExtractor` | `(message) => string \| undefined` | `undefined` | Extract request ID from response |
| `responseMatcher` | `(message, requestId) => boolean` | `undefined` | Custom response matching logic |
| `responseDataExtractor` | `(message) => any` | `undefined` | Extract data from response message |

## Custom Plugins

### Logging Plugin

```typescript
ws.use({
    name: 'ws-logger',
    install(api) {
        api.addHook('open', ({ url }) => {
            console.log(`[WS] Connected to ${url}`);
        });
        api.addHook('message', ({ message }) => {
            console.log(`[WS] Received:`, message.data);
        });
        api.addHook('send', ({ data }) => {
            console.log(`[WS] Sending:`, data);
        });
        api.addHook('error', ({ error, attempt }) => {
            console.error(`[WS] Error (attempt ${attempt + 1}):`, error.message);
        });
        api.addHook('close', ({ code, reason, reconnectCount }) => {
            console.log(`[WS] Closed ${code} ${reason} (reconnected ${reconnectCount} times)`);
        });
    },
});
```

### Auto-Reconnect with Custom Logic

```typescript
import { createAutoReconnectPlugin } from '@ahriknow/afetch/ws';

ws.use(createAutoReconnectPlugin({
    maxAttempts: 10,
    delay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000), // exponential backoff, max 30s
    shouldReconnect: (ctx) => {
        // Don't reconnect on auth failures
        if (ctx.error.cause instanceof CloseEvent) {
            return ctx.error.cause.code !== 4001; // custom auth error code
        }
        return true;
    },
}));
```

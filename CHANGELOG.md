# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.6] - 2026-07-01

### Fixed

- **Timeout detection**: `createTimeoutController` now tracks timeout via an internal `timedOut` flag instead of inferring from `!config.signal?.aborted`. This fixes a bug where a user-provided `AbortSignal` was incorrectly treated as a timeout.
- **SSE module**: Added `await` on `finalizeClose` to ensure close hooks complete before cleanup. Added `void` to `runClose` for unhandled Promise compliance.
- **WebSocket module**: Added `void` to `runOpen`/`runClose`/`runSend` hook calls for unhandled Promise compliance.

### Added

- Test coverage for timeout detection when both `timeout` and user `signal` are provided.

## [0.0.5]

### Added

- **SSE module**: Server-Sent Events client as an independent sub-module, importable from `@ahriknow/afetch/sse`
  - `createSSE()` — factory for SSE client with full state management (CONNECTING/OPEN/CLOSED)
  - Plugin system with `connect`, `message`, `error`, `close` lifecycle hooks
  - Built-in auto-reconnect plugin (`createAutoReconnectPlugin`) with configurable max attempts, custom delay, and reconnect predicate
  - SSE protocol parsing: handles `event`, `data`, `id`, `retry` fields, multiline data, comment lines, and `\r\n`/`\r` normalization
  - Dynamic retry field updating from server-sent `retry:` values
  - `SSEError` class with typed error codes (`NETWORK`, `PARSE`, `TIMEOUT`, `CONFIG`) and convenience getters
  - Full TypeScript support with exported types: `SSEConfig`, `SSEEvent`, `SSEClient`, `SSEState`, `SSEErrorType`
  - 100% test coverage (53 tests)
- **WebSocket module**: WebSocket client as an independent sub-module, importable from `@ahriknow/afetch/ws`
  - `createWS()` — factory for WebSocket client with full state management (CLOSED/CONNECTING/OPEN/CLOSING)
  - Plugin system with `open`, `message`, `error`, `close`, `send` lifecycle hooks
  - Built-in auto-reconnect plugin (`createAutoReconnectPlugin`) with configurable max attempts, custom delay, and reconnect predicate
  - Built-in request-sync plugin (`createRequestSyncPlugin`) for request-response pattern over WebSocket with ID matching
  - Auto JSON parse/serialize (`autoParse` config option)
  - Connection timeout and heartbeat support
  - `WSError` class with typed error codes (`NETWORK`, `PARSE`, `TIMEOUT`, `CONFIG`) and convenience getters
  - Full TypeScript support with exported types: `WSConfig`, `WSMessage`, `WSClient`, `WSState`, `WSErrorType`
  - 100% test coverage (363 tests total)

## [0.0.4] - 2026-06-22

### Fixed

- **mergeConfig**: Removed dead code `delete mergedHeaders['Content-Type']` — `mergeHeaders` lowercases all header keys, so only `content-type` needs checking
- **Retry plugin**: `executeFetch` now applies `transformRequest` and automatic JSON serialization (same as the main request flow), preventing retried requests from sending raw objects
- **Cache plugin**: Unified `afterResponse` hook return value to always return `undefined` (was inconsistently returning `response` in some paths)

### Changed

- **transformData**: Split into two type-safe functions — `transformData` (request transforms, accepts `headers`) and `transformResponseData` (response transforms, accepts `AResponse`)
- **Error handling**: Extracted `getErrorMessage(err, fallback)` utility to eliminate duplicate `(error as Error).message` patterns across `afetch.ts` and `retry.ts`
- **Config validation**: `mergeConfig` now validates that at least `url` or `baseURL` is provided, throwing a `CONFIG` error early instead of producing malformed requests
- **createTask**: Removed redundant `responsePromise` variable — `wait()` now directly returns `requestPromise`

### Added

- `getErrorMessage` utility exported from `src/utils.ts`

## [0.0.3] - 2026-06-18

### Fixed

- Retry plugin `executeFetch` now uses `buildURL` for proper URL construction with query params
- Retry plugin `buildResponse` now respects `responseType` instead of always trying `json()`
- Cache plugin `defaultCacheKey` now uses `buildURL` and filters `null`/`undefined` params
- Content-Type case sensitivity: `executeRequest` now checks both `content-type` and `Content-Type` to prevent overwriting user-set headers

### Changed

- `mergeConfig` simplified with `resolveOpt`/`resolveFallback`/`resolveValue` helpers, reducing ~120 lines to ~30 lines
- Extracted shared `resolveFetchFn` utility to eliminate duplicated fetch adapter resolution logic
- Cache plugin `evict()` and `ResponseCache.evict()` optimized from O(n log n) to O(1) using Map insertion order
- Removed unused `PluginCleanup` type export
- Removed unused `QueueItem.fn` field from `RequestQueue`
- Installed missing `typescript-eslint` dependency for ESLint flat config

## [0.0.2] - 2026-06-16

### Changed

- **BREAKING**: Queue plugin (`createQueuePlugin`) now auto-controls concurrency via plugin hooks instead of manual `run()` wrapping. Just `api.use(queuePlugin)` and all requests are concurrency-limited automatically.
- Export `QueuePlugin` type with `pending`, `queued`, `clear()` properties
- Split README (490→89 lines) into per-language documentation under `docs/en/` and `docs/zh-CN/`
- Updated README badges and codecov configuration

### Added

- Event-bus plugin example (`examples/event-bus.ts`)
- Documentation files: `plugins`, `error-handling`, `cancellation`, `transforms`, `typescript`, `configuration`, `api-reference` (English + Chinese)
- Queue plugin with `RequestQueue` class for concurrency control
- Cache plugin with `ResponseCache` class for in-memory caching
- `all()` method for concurrent requests
- `race()` method for racing requests
- Download progress tracking via `onDownloadProgress`

### Fixed

- Codecov YAML configuration for develop branch

## [0.0.1] - 2026-06-16

### Added

- Core fetch wrapper with full TypeScript type safety
- All HTTP methods: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
- Plugin system with lifecycle hooks (`beforeRequest`, `afterResponse`, `onError`)
- Retry plugin with exponential backoff, status matching, and custom hooks
- Event bus plugin for request lifecycle observation
- Task API for fine-grained request cancellation (`task.abort()`, `task.wait()`)
- AbortController support with automatic timeout
- Request and response transforms
- Query parameter handling
- Pre-configured instance creation (`createInstance`)
- Custom fetch adapter support (`fetchAdapter`)
- Comprehensive error handling (`AFetchError` with typed error codes)
- 100% test coverage (147 tests)
- Full English and Chinese documentation
- Codecov integration
- GitHub Actions CI/CD with auto-publish on v* tags

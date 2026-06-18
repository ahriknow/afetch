# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

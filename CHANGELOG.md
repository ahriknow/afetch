# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-16

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
- Progress tracking (upload/download)
- Pre-configured instance creation (`createInstance`)
- Custom fetch adapter support (`fetchAdapter`)
- Comprehensive error handling (`AFetchError` with typed error codes)
- 100% test coverage (130 tests)
- Full English and Chinese documentation
- Codecov integration
- GitHub Actions CI/CD with auto-publish on v* tags

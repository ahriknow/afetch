# Contributing to afetch

Thank you for your interest in contributing to afetch!

## Getting Started

```bash
git clone https://github.com/ahriknow/afetch.git
cd afetch
npm install
```

## Development

### Commands

```bash
npm run build          # Build the project
npm test               # Run tests
npm run test:coverage  # Run tests with coverage (must be 100%)
npm run format         # Format code with Prettier
```

### Project Structure

```
src/
├── index.ts            # Entry point and exports
├── afetch.ts           # Core implementation
├── types.ts            # Type definitions
├── plugin.ts           # Plugin system (HookRunner)
├── events.ts           # Event emitter
├── error.ts            # AFetchError class
├── utils.ts            # Utilities
└── plugins/
    ├── index.ts        # Plugin exports
    ├── retry.ts        # Retry plugin (createRetryPlugin)
    ├── event-bus.ts    # Event bus plugin (createEventBusPlugin)
    ├── queue.ts        # Queue plugin (createQueuePlugin + RequestQueue)
    └── cache.ts        # Cache plugin (createCachePlugin + ResponseCache)
```

## Writing a Plugin

Plugins implement the `AFetchPlugin` interface:

```typescript
import type { AFetchPlugin } from '@ahriknow/afetch';

const myPlugin: AFetchPlugin = {
    name: 'my-plugin',
    install(api) {
        api.addHook('beforeRequest', ({ config }) => {
            // Runs before each request
            // Return an AResponse to short-circuit (e.g. serve from cache)
        });

        api.addHook('afterResponse', ({ config, response }) => {
            // Runs after each response
            // Return a new AResponse to replace the response
        });

        api.addHook('onError', ({ config, error }) => {
            // Runs on request error
            // Return a new AResponse to recover (e.g. retry)
        });
    },
};
```

### Plugin Guidelines

- Plugin names must be unique
- `install()` is called once per instance — duplicate `use()` calls are ignored
- Keep plugins focused on a single responsibility
- Use `config.meta` for per-request plugin configuration
- Export both the plugin factory and any standalone utilities

## Testing

All code must have 100% test coverage. The `coverageThreshold` in `jest.config.mjs` enforces this.

```bash
npm run test:coverage
```

Coverage tests are in `test/coverage.test.ts` (edge cases and branch coverage) alongside `test/afetch.test.ts` (main tests).

## Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Ensure tests pass: `npm run test:coverage`, 100%
5. Commit with a conventional message: `feat: add my feature`
6. Push and open a Pull Request

### AI-Assisted Contributions

We welcome the use of AI tools (e.g. GitHub Copilot, ChatGPT, Claude) to assist development, but the following rules must be followed:

- **Line-by-line review required** — All AI-generated code must be reviewed line-by-line by the author before submission. The author is fully responsible for every line of code in their PR, regardless of how it was produced.
- **Function-level granularity (80 lines code)** — AI may generate code at function level at most. Do not submit entire files, modules, or architectural changes generated wholesale by AI. Break work into individual functions, verify each one, then assemble.
- **100% test coverage is mandatory** — The `coverageThreshold` in `jest.config.mjs` enforces `100%` on all metrics (statements, branches, functions, lines). PRs that drop coverage below 100% will not be merged.
- **Human-authored tests** — Tests should be written (or at minimum, thoroughly reviewed and understood) by the human contributor. Blindly trusting AI-generated tests defeats the purpose of testing.

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `test:` — Tests
- `refactor:` — Code refactoring
- `chore:` — Maintenance

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

# Contributing to afetch

Thank you for your interest in contributing to afetch! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Create a new branch for your feature/fix

## Development

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher

### Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Run linter
npm run lint

# Format code
npm run format
```

### Project Structure

```
afetch/
├── src/              # Source code
│   ├── index.ts      # Main entry point
│   ├── afetch.ts     # Core implementation
│   ├── types.ts      # Type definitions
│   ├── error.ts      # Error handling
│   ├── interceptors.ts # Interceptor manager
│   └── utils.ts      # Utility functions
├── test/             # Test files
├── examples/         # Usage examples
└── dist/             # Build output
```

### Writing Tests

- Tests are located in the `test/` directory
- Use Jest for testing
- Run tests with `npm test`
- Ensure all tests pass before submitting a PR

### Code Style

- Follow the existing code style
- Use TypeScript strict mode
- Run `npm run lint` to check for linting errors
- Run `npm run format` to format code

## Submitting Changes

1. Commit your changes with a clear commit message
2. Push to your fork
3. Create a Pull Request
4. Describe your changes in the PR description

## Reporting Issues

- Use the GitHub issue tracker
- Include a clear description of the issue
- Provide steps to reproduce if applicable
- Include error messages and stack traces

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

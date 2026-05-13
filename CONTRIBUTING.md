# Contributing to dakera-langchain-js

Thank you for your interest in contributing to the Dakera LangChain.js integration! This guide covers everything you need to get started.

## Reporting Bugs

Use the [Bug Report](https://github.com/Dakera-AI/dakera-langchain-js/issues/new?template=bug_report.md) template. Please include:
- A clear description of the bug and steps to reproduce
- Your Node.js, LangChain.js, and dakera-langchain-js versions
- Whether you are using `DakeraMemory`, `DakeraVectorStore`, or both
- Whether you are connecting to a local or hosted Dakera instance
- Relevant error messages or stack traces

## Suggesting Features

Use the [Feature Request](https://github.com/Dakera-AI/dakera-langchain-js/issues/new?template=feature_request.md) template. Describe the problem you are solving, your proposed solution, and any alternatives you have considered.

## Security Vulnerabilities

**Do not open public issues for security vulnerabilities.** See [SECURITY.md](.github/SECURITY.md) for responsible disclosure instructions — email security@dakera.ai.

## Pull Request Process

1. Fork the repository and create a branch from `main`:
   ```bash
   git checkout -b fix/your-fix-name
   ```
2. Make your changes and ensure tests pass
3. Open a pull request against `main` with a clear description

## Development Setup

**Prerequisites:** Node.js 18+, a running Dakera server (for integration tests)

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests (unit only — no server required)
npm test

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

## Code Style

- **TypeScript strict mode**: all code must pass `tsc --strict`
- **Linter**: ESLint via `npm run lint` — no lint errors
- **Tests**: vitest — all tests must pass; new features require tests
- **Formatting**: Prettier — run `npx prettier --check .`

## Testing Against a Live Dakera Server

Some scenarios require a running Dakera instance. Start one locally with Docker:

```bash
docker run -p 3300:3300 ghcr.io/dakera-ai/dakera:latest
```

Then set the server URL in your test environment:

```bash
DAKERA_SERVER_URL=http://localhost:3300 npm test
```

For unit tests that do not require a live server, mock the Dakera client:

```typescript
import { vi } from 'vitest';

vi.mock('@dakera/js', () => ({
  Dakera: vi.fn().mockImplementation(() => ({
    store: vi.fn().mockResolvedValue({ id: 'mem-123' }),
    recall: vi.fn().mockResolvedValue({ memories: [] }),
  })),
}));
```

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

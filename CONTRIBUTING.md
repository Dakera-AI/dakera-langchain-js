# Contributing to dakera-langchain-js

Thank you for your interest in contributing to the Dakera LangChain.js integration! This guide covers
everything you need to get started.

## Reporting Bugs

Use the [Bug Report](https://github.com/Dakera-AI/dakera-langchain-js/issues/new?template=bug_report.md)
template. Please include:
- A clear description of the bug and steps to reproduce
- Your Node.js, `@langchain/core`, `@dakera-ai/dakera` and `@dakera-ai/langchain` versions
- The Dakera server version (`curl http://localhost:3000/health` shows it)
- Which class you are using (`DakeraMemory`, `DakeraVectorStore`, ...)
- Relevant error messages or stack traces

## Suggesting Features

Use the [Feature Request](https://github.com/Dakera-AI/dakera-langchain-js/issues/new?template=feature_request.md)
template. Describe the problem you are solving, your proposed solution, and any alternatives you have
considered.

## Security Vulnerabilities

**Do not open public issues for security vulnerabilities.** See [SECURITY.md](.github/SECURITY.md) for
responsible disclosure instructions — report via
[GitHub Security Advisories](https://github.com/Dakera-AI/dakera-langchain-js/security/advisories/new).

## Pull Request Process

1. Fork the repository and create a branch from `main`:
   ```bash
   git checkout -b fix/your-fix-name
   ```
2. Make your changes; add or update tests, examples and the README for anything user-facing, and add an
   entry to [CHANGELOG.md](CHANGELOG.md)
3. Run the checks below
4. Open a pull request against `main` with a clear description

## Development Setup

**Prerequisites:** Node.js 20+; Docker for the live tests and examples.

```bash
npm install                 # install dependencies
npm run lint                # ESLint (src, tests, examples)
npm run typecheck           # tsc on src and tests
npm test                    # unit tests (vitest); live tests are skipped without a server
npm run build               # CJS + ESM + .d.ts → dist/
npm run typecheck:examples  # tsc on examples/ (after a build)
```

CI runs lint, typecheck, unit tests and the build on Node 20 and 22, and the live tests and every example
against `ghcr.io/dakera-ai/dakera:0.12.3`.

## Testing Against a Live Dakera Server

`tests/integration.test.ts` exercises every class against a real server. It is skipped unless
`DAKERA_API_URL` is set:

```bash
docker run -d --name dakera-test -p 3300:3300 \
  -e DAKERA_PORT=3300 -e DAKERA_AUTH_ENABLED=false \
  ghcr.io/dakera-ai/dakera:0.12.3

DAKERA_API_URL=http://localhost:3300 npm test
```

For a server with auth enabled, also set `DAKERA_API_KEY`. The examples run against the same server:

```bash
npm run build
for f in examples/*.ts; do DAKERA_API_URL=http://localhost:3300 npx tsx "$f" || break; done
```

## Code Style

- **TypeScript strict mode** (with `exactOptionalPropertyTypes`): `npm run typecheck` must pass
- **ESLint**: `npm run lint` must pass
- **Tests**: vitest; unit tests mock `@dakera-ai/dakera` with `vi.mock`, live tests run against a server
- **Docs**: public classes, methods and options carry TSDoc comments

Unit tests mock the Dakera client like this:

```typescript
import { vi } from "vitest";

vi.mock("@dakera-ai/dakera", () => ({
  DakeraClient: vi.fn().mockImplementation(function () {
    return {
      storeMemory: vi.fn().mockResolvedValue({ memory: { id: "mem_1" } }),
      recall: vi.fn().mockResolvedValue({ memories: [] }),
    };
  }),
}));
```

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

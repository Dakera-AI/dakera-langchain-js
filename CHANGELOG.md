# Changelog

## [Unreleased]

## [0.1.2] - 2026-05-13

### Security
- **CVE GHSA-3644-q5cj-c5c7**: bumped transitive dependency `langsmith` from 0.5.25 to ≥0.6.0 via `overrides`. Fixes "Public prompt pull deserializes untrusted manifests without trust boundary warning" (High severity).

## [0.1.1] - 2026-05-13

### Fixed
- **`.gitignore`**: added `*.db` and `*.sqlite` patterns to prevent accidental commit of local databases
- **SDK version**: bumped `@dakera-ai/dakera` peer/dev dependency to `^0.11.54`
- **`recall()` response type fix**: aligned TypeScript types with updated SDK response shape

### Changed
- Bumped GitHub Actions: `actions/checkout` v4 → v6, `actions/setup-node` v4 → v6
- Updated dev dependencies: `@langchain/core` 1.1.41 → 1.1.46, `@types/node` 20 → 25, `vitest` 4.1.5 → 4.1.6

### Added
- Community health files: `CONTRIBUTING.md`, `SECURITY.md`, issue templates, PR template
- Dependabot configuration for npm and GitHub Actions

## [0.1.0] - 2026-05-13

### Added
- Initial release — LangChain.js integration for Dakera AI memory platform
- `DakeraMemory` class for conversational memory (TypeScript/ESM + CJS)
- npm publish via NPM_TOKEN

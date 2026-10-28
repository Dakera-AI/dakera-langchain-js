# Changelog

## [Unreleased]

## [0.4.0] - 2026-10-27

Dakera server **v0.12.3** support. Requires `@dakera-ai/dakera` `^0.12.3` (peer and dev dependency).
Verified against `ghcr.io/dakera-ai/dakera:0.12.3` (every example) and v0.12.0.

### Breaking
- `DakeraKnowledgeGraph.build(memoryId, { depth?, minSimilarity? })` takes the seed memory the server
  requires; `build()` without it was always refused (`422 missing field memory_id`). It returns the
  server's answer as is (`{ root, total_nodes }`).
- `DakeraKnowledgeGraph.summarize(memoryIds, { targetType? })` takes the memories to summarize (at least
  two) and returns `KnowledgeSummary` (`summary_memory`, `source_count`), the server's answer; it sent no
  ids before and always failed.
- `AgentMemory.createdAt` is typed `number | string`: v0.12 servers send Unix seconds.
- `DakeraNamespaceManager.list()` returns `dimension` and `vectorCount` as `undefined` (`vectorCount` is typed
  `number | undefined`): the server's listing carries names only, and the `0` it returned before was a
  placeholder, not a count. `get()` reads both.

### Fixed
- `DakeraMemory.loadMemoryVariables()` on a server before v0.12.3 no longer throws for an agent that has
  stored nothing yet: such a server answers `404 NAMESPACE_NOT_FOUND`, so the first turn of every new agent
  failed. It now recalls nothing (`""`), like a v0.12.3 server.
- `DakeraVectorStore`'s `embeddingModel` option was documented but never sent; it is now the `model` of
  every write and search.
- `DakeraMemory` returns at most `recallK` memories. A server appends session-neighbourhood context after
  the ranked results by default; recall now asks for `neighborhood_mode: "separate"` and leaves out any
  item marked `retrieval: "neighborhood"` (older servers ignore the mode).
- `DakeraEntityExtractor.configure()` configures the agent's memory namespace
  (`_dakera_agent_<agentId>`) instead of a namespace named like the agent, which did not exist (`404`).
  An agent that has stored nothing yet is created first (server v0.12.2+).
- `DakeraAgentTools.importMemories()` / `exportMemories()` work: the server takes a multipart JSON-lines
  file and answers the export file itself, which `@dakera-ai/dakera` 0.12.3 does not handle (the import
  was refused with `400`, the export returned no memories). Both now call `/v1/import` and `/v1/export`
  directly; an import line needs only `content` (`id` and timestamps are filled in), and the import returns
  the job status (`MemoryImportJob`).
- `DakeraSessionManager.end(summary)` stores the summary (it was ignored).
- `DakeraAgentTools.memories()` returns each memory's `tags` (always `[]` before).
- `DakeraNamespaceManager.create()` no longer passes `metadata` to the SDK (not a server field).

### Added
- `DakeraMemory` option `sessionId`: the stored turns belong to that session (e.g. the id returned by
  `DakeraSessionManager.start()`).
- `NamespaceInfo.kind` (`"data"`, `"agent"` or `"system"`, server v0.12.2+).
- `tests/integration.test.ts`: every class against a live server, skipped unless `DAKERA_API_URL` is set; the
  CI integration job runs it (before, that job ran the unit tests only).
- ESLint (flat config with `typescript-eslint`); `npm run lint` covers `src`, `tests` and `examples` and runs
  in CI. `npm run typecheck` also checks the tests; `npm run typecheck:examples` checks the examples against
  the build and runs in CI. `tsx` is a dev dependency.
- Examples `chat_chain.ts` (`DakeraMemory` in an LCEL chain, runnable without an LLM key) and
  `agent_tools.ts`, and `examples/README.md`.
- `DakeraSessionManager.start(metadata, { idleTimeoutSecs })` and `touch()`: the server ends a session
  after 4 h without activity by default; `touch()` keeps it open and returns `false` once it has ended.
  `SessionInfo` gains `summary` and `endedReason` (`"client"` or `"idle"`).
- `DakeraNamespaceManager.create(name, { dimensions, distance })`; `indexType` and `metadata` are
  deprecated (never sent).

### Changed
- README rewritten for LangChain v1: chains are built with LCEL, and `ConversationChain` is imported from
  `@langchain/classic` (`langchain/chains` no longer exists). Every class is documented; the quick start
  pins `ghcr.io/dakera-ai/dakera:0.12.3` and shows the server's real `/health` answer; compatibility table,
  errors and retries. Every TypeScript snippet is type-checked against the packed package and was run
  against a v0.12.3 server.
- TSDoc on every public class, method, option and result field; doc examples use the server's default port
  3000.
- Examples import `@dakera-ai/langchain` (some imported `../src`), use fixed document ids so a re-run
  overwrites instead of adding copies, `sessions.ts` stores turns in the session, `entities.ts` shows what
  the rule-based extractor finds, and every example has run instructions. CI runs every file in
  `examples/`.
- CONTRIBUTING: Node.js 20+, the real scripts, live tests with `DAKERA_API_URL` (it named
  `DAKERA_SERVER_URL`) and a mock of `@dakera-ai/dakera` (it mocked `@dakera/js`).
- CI: integration and example jobs run against `ghcr.io/dakera-ai/dakera:0.12.3` instead of `latest`,
  readiness is polled from the runner (the 0.12.3 image has no `curl` for an in-container health check),
  and a failing example fails the job (examples set a non-zero exit code).
- Dev dependencies: `npm audit fix` (vitest 4.1.12, vite 8.3.5, zod 4.6.7, source-map-js 1.2.2,
  esbuild 0.27.2); `npm audit` reports 0 vulnerabilities.
- `@dakera-ai/dakera` 0.12.3 no longer retries a failed store (a `5xx` or timeout on a write);
  `DakeraMemory.saveContext()` surfaces such an error instead of storing the turn twice.

## [0.3.0] - 2026-10-01

### Changed
- Requires `@dakera-ai/dakera` `^0.12.1` (peer and dev dependency). Compatible with Dakera server v0.12.0 and v0.11.108.
- `DakeraKnowledgeGraph.link()` now calls the SDK's `memoryLink(sourceId, targetId, { agentId, label })`. The SDK requires the owning agent, the server records every explicit link as `linked_by`, and the optional `relation` argument is sent as an informational label only.
- Pass-through of the SDK's typed errors (`ValidationError`, `NotFoundError`, `ConflictError`, `UnsupportedCapabilityError`, and others) is unchanged; they are thrown as-is.

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

# dakera-langchain-js

LangChain.js memory integration for the Dakera AI platform — DakeraMemory class extending
LangChain.js BaseMemory for use in chains and agents.

## Key Commands
```bash
npm install              # Install dependencies
npm run build            # Compile TypeScript
npm test                 # Run tests
npm run lint             # ESLint
npm run typecheck        # Type check (tsc --noEmit)
```

## Architecture
- `src/` — DakeraMemory class; session-scoped memory load/save compatible with LangChain.js
- `tests/` — Integration tests (requires a running Dakera server)

## Conventions
- Peer dependency on `@langchain/core` — do not bundle it
- Published to npm as `@dakera-ai/langchain`
- TypeScript strict mode; exports must include .d.ts declarations

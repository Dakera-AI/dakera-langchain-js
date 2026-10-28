# Examples

Runnable examples for `@dakera-ai/langchain`. Each one is a standalone script that talks to a Dakera
server; none needs an LLM API key (`chat_chain.ts` uses LangChain's fake chat model — swap in your own).

## Prerequisites

1. A Dakera server:

   ```bash
   docker run -d --name dakera -p 3000:3000 -e DAKERA_ROOT_API_KEY=dk-mykey ghcr.io/dakera-ai/dakera:0.12.3
   ```

2. The package built from this repository (the examples import `@dakera-ai/langchain`, which resolves to
   `dist/`):

   ```bash
   npm install
   npm run build
   ```

## Running

From the repository root:

```bash
export DAKERA_API_URL=http://localhost:3000   # default
export DAKERA_API_KEY=dk-mykey                # omit for a server running without auth

npx tsx examples/basic_memory.ts
```

`npm run typecheck:examples` type-checks all of them.

| File | Shows |
|---|---|
| [`basic_memory.ts`](basic_memory.ts) | `DakeraMemory`: store conversation turns, recall the relevant ones |
| [`chat_chain.ts`](chat_chain.ts) | `DakeraMemory` in an LCEL chat chain (prompt → model → parser) |
| [`rag_pipeline.ts`](rag_pipeline.ts) | `DakeraVectorStore`: index documents, semantic search, retriever |
| [`hybrid_search.ts`](hybrid_search.ts) | Semantic search with a metadata filter, BM25 full-text and hybrid search |
| [`sessions.ts`](sessions.ts) | `DakeraSessionManager`: start, store turns in the session, `touch()`, end with a summary |
| [`knowledge_graph.ts`](knowledge_graph.ts) | `DakeraKnowledgeGraph`: link, export, query, build, summarize |
| [`entities.ts`](entities.ts) | `DakeraEntityExtractor`: extract entities, turn on extraction for an agent |
| [`namespaces.ts`](namespaces.ts) | `DakeraNamespaceManager`: list, create, read, delete |
| [`agent_tools.ts`](agent_tools.ts) | `DakeraAgentTools`: import, list, stats, export |

`sessions.ts` and `entities.ts` need a server v0.12.2 or later; the others run on v0.12.0 and later.

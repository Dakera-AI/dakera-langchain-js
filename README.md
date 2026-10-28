# @dakera-ai/langchain

**Persistent, decay-weighted memory and server-side vector search for LangChain.js, backed by a self-hosted
[Dakera](https://dakera.ai) server.**

[![CI](https://github.com/Dakera-AI/dakera-langchain-js/actions/workflows/ci.yml/badge.svg)](https://github.com/Dakera-AI/dakera-langchain-js/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@dakera-ai/langchain)](https://www.npmjs.com/package/@dakera-ai/langchain)
[![Downloads](https://img.shields.io/npm/dm/@dakera-ai/langchain)](https://www.npmjs.com/package/@dakera-ai/langchain)
[![Node](https://img.shields.io/node/v/@dakera-ai/langchain)](https://www.npmjs.com/package/@dakera-ai/langchain)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/Dakera-AI/dakera-langchain-js/blob/main/LICENSE)
[![Dakera server](https://img.shields.io/badge/Dakera%20server-v0.12.3-22c55e)](https://dakera.ai)
[![LoCoMo](https://img.shields.io/badge/LoCoMo-88.2%25-brightgreen)](https://dakera.ai/benchmark)

Give your chains and agents a memory that survives restarts: every turn is stored on the Dakera server, and
each new input recalls the memories most relevant to it, weighted by importance and recency. Dakera embeds
text on the server, so there is no embeddings API key and no local model — one self-hosted container holds
your agents' memories and your RAG documents.

## Why Dakera

- **Memory that outlives the process.** Turns are stored on the server, so a new request, a new worker or a
  redeploy recalls what the user said yesterday — no chat log to persist yourself.
- **Recall, not replay.** `DakeraMemory` puts the few memories relevant to the current input into the prompt
  instead of the last *N* messages; importance and time decay keep stale context from crowding out fresh
  facts.
- **No embeddings bill.** Documents and queries are embedded by the server: `DakeraVectorStore` needs no
  `Embeddings` instance and no OpenAI / Hugging Face calls.
- **Memory and RAG in one place.** Conversation memory, a vector store with semantic, BM25 and hybrid
  search, sessions, a knowledge graph and entity extraction share one server and one API key.
- **Self-hosted.** A single container (`ghcr.io/dakera-ai/dakera`) on your own infrastructure; your users'
  data stays with you.
- **Measured recall.** 88.2% Recall@20 on the [LoCoMo](https://dakera.ai/benchmark) long-conversation memory
  benchmark.

## Contents

- [Quick start](#quick-start)
- [Compatibility](#compatibility)
- [What's new in 0.4.0](#whats-new-in-040)
- [DakeraMemory](#dakeramemory)
- [DakeraVectorStore](#dakeravectorstore)
- [DakeraSessionManager](#dakerasessionmanager)
- [DakeraKnowledgeGraph](#dakeraknowledgegraph)
- [DakeraEntityExtractor](#dakeraentityextractor)
- [DakeraNamespaceManager](#dakeranamespacemanager)
- [DakeraAgentTools](#dakeraagenttools)
- [Configuration](#configuration)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Related packages](#related-packages)
- [Links](#links)
- [License](#license)

## Quick start

### 1. Run Dakera

```bash
docker run -d --name dakera -p 3000:3000 -v dakera-data:/data \
  -e DAKERA_ROOT_API_KEY=dk-mykey \
  ghcr.io/dakera-ai/dakera:0.12.3

curl http://localhost:3000/health   # {"service":"dakera","status":"healthy","version":"0.12.3",...}
```

The image ships its default embedding model, so the server is ready in seconds; memories persist in the
`dakera-data` volume. Docker Compose, Kubernetes and Helm setups:
[dakera-deploy](https://github.com/Dakera-AI/dakera-deploy).

### 2. Install

```bash
npm install @dakera-ai/langchain @dakera-ai/dakera @langchain/core
npm install @langchain/openai   # or the chat-model package you use
```

`@dakera-ai/dakera` (the Dakera client) and `@langchain/core` are peer dependencies.

### 3. Chat with memory

```typescript
import { DakeraMemory } from "@dakera-ai/langchain";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI } from "@langchain/openai";

const memory = new DakeraMemory({
  apiUrl: "http://localhost:3000",
  apiKey: "dk-mykey",
  agentId: "my-agent",
});

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant. What you remember about the user:\n{history}"],
  ["human", "{input}"],
]);
const chain = prompt.pipe(new ChatOpenAI({ model: "gpt-4o-mini" })).pipe(new StringOutputParser());

async function chat(input: string): Promise<string> {
  const { history } = await memory.loadMemoryVariables({ input }); // recall
  const output = await chain.invoke({ history, input });
  await memory.saveContext({ input }, { output }); // store the turn
  return output;
}

await chat("My project is called NeuralBridge and it is written in Rust.");
// Later — another request, another process, after a restart:
console.log(await chat("What language is my project written in?")); // e.g. "NeuralBridge is written in Rust."
```

Any LangChain.js chat model works in place of `ChatOpenAI`.

## Compatibility

| `@dakera-ai/langchain` | Dakera server | `@dakera-ai/dakera` | `@langchain/core` | Node.js |
|---|---|---|---|---|
| **0.4.x** | v0.12.0 – **v0.12.3** | `^0.12.3` | `>=1.1.0` | `>=20` |
| 0.3.x | v0.12.0 | `^0.12.1` | `>=1.1.0` | `>=20` |

v0.12.3 keeps the session-neighbourhood context out of `DakeraMemory`'s results and answers an agent that has
stored nothing with an empty recall; `DakeraSessionManager.touch()` and `DakeraEntityExtractor.configure()` for
an agent that has stored nothing yet need v0.12.2 or later. Everything else works on any v0.12 server.

## What's new in 0.4.0

- **Dakera server v0.12.3** with `@dakera-ai/dakera` `^0.12.3`.
- `DakeraMemory` returns at most `recallK` memories, never the server's extra neighbourhood context, and no
  longer fails the first turn of a new agent on servers before v0.12.3.
- New `sessionId` option: store the turns in a [session](#dakerasessionmanager).
- Sessions: `start(meta, { idleTimeoutSecs })`, `touch()`, and `summary` / `endedReason` on session info;
  `end(summary)` stores the summary.
- Knowledge graph: `build(memoryId, …)` and `summarize(memoryIds, …)` take the memories the server requires
  (both always failed before — **breaking** signature change).
- Fixed entity `configure()`, memory import / export and `DakeraVectorStore`'s `embeddingModel`.

Full list: [CHANGELOG](https://github.com/Dakera-AI/dakera-langchain-js/blob/main/CHANGELOG.md).

## DakeraMemory

A LangChain.js `BaseMemory`. `loadMemoryVariables({ input })` recalls the agent's memories most relevant to
the input — semantic search weighted by importance and recency — and returns them under `memoryKey`;
`saveContext(inputs, outputs)` stores the turn (`Human: …\nAI: …`) as one memory.

```typescript
import { DakeraMemory } from "@dakera-ai/langchain";

const memory = new DakeraMemory({
  apiUrl: "http://localhost:3000",
  apiKey: process.env.DAKERA_API_KEY,
  agentId: "user-42", // one agent per user or assistant
  recallK: 5,         // memories recalled per turn
  importance: 0.7,    // importance of stored turns (0 – 1)
});

await memory.saveContext({ input: "I prefer metric units." }, { output: "Noted!" });
const { history } = await memory.loadMemoryVariables({ input: "Which units do I like?" });
console.log(history); // "Human: I prefer metric units.\nAI: Noted!"
```

| Option | Type | Default | Description |
|---|---|---|---|
| `apiUrl` | `string` | — | Dakera server URL, e.g. `http://localhost:3000` **(required)** |
| `apiKey` | `string` | — | Dakera API key; omit for a server running without auth |
| `agentId` | `string` | — | Agent whose memories are stored and recalled **(required)** |
| `recallK` | `number` | `5` | Maximum memories recalled per turn |
| `minImportance` | `number` | `0` | Recall only memories at least this important (0 – 1) |
| `importance` | `number` | `0.7` | Importance assigned to stored turns (0 – 1) |
| `memoryKey` | `string` | `"history"` | Prompt variable the recalled memories fill |
| `inputKey` | `string` | first input key | Input used as the recall query |
| `sessionId` | `string` | — | Session the stored turns belong to (see [`DakeraSessionManager`](#dakerasessionmanager)) |

`history` holds at most `recallK` memories, best first. A v0.12.3 server can add the session's neighbouring
memories as extra context; `DakeraMemory` asks for that context separately and leaves it out, so `recallK` is
a hard limit. `clear()` is a no-op: Dakera memories are persistent (delete them with the `@dakera-ai/dakera`
client).

### Legacy chains

`ConversationChain` and the other legacy chains moved to `@langchain/classic` in LangChain v1
(`npm install @langchain/classic`). They take `DakeraMemory` as their `memory`:

```typescript
import { ConversationChain } from "@langchain/classic/chains";
import { ChatOpenAI } from "@langchain/openai";
import { DakeraMemory } from "@dakera-ai/langchain";

const chain = new ConversationChain({
  llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
  memory: new DakeraMemory({ apiUrl: "http://localhost:3000", apiKey: "dk-mykey", agentId: "my-agent" }),
});

const { response } = await chain.invoke({ input: "What was I working on?" });
console.log(response);
```

## DakeraVectorStore

A LangChain.js `VectorStore` over a Dakera namespace. The server embeds documents and queries, so there is no
`Embeddings` instance to configure. Results carry the document's `id` and similarity `score` in `metadata`.

```typescript
import { Document } from "@langchain/core/documents";
import { DakeraVectorStore } from "@dakera-ai/langchain";

const vectorStore = new DakeraVectorStore({
  apiUrl: "http://localhost:3000",
  apiKey: "dk-mykey",
  namespace: "my-docs", // created on first write
});

await vectorStore.addDocuments(
  [
    new Document({ pageContent: "Dakera is a persistent memory platform for AI agents.", metadata: { source: "docs" } }),
    new Document({ pageContent: "It has Python, JavaScript, Rust and Go SDKs.", metadata: { source: "docs" } }),
  ],
  { ids: ["intro-1", "intro-2"] }, // optional; re-adding an id overwrites it
);

const results = await vectorStore.similaritySearchWithScore("Which languages are supported?", 2);
for (const [doc, score] of results) {
  console.log(score.toFixed(3), doc.pageContent);
}

// Metadata filter (Dakera filter syntax)
const docsOnly = await vectorStore.similaritySearch("memory", 4, { source: { $eq: "docs" } });
console.log(docsOnly.length);
```

| Option | Type | Default | Description |
|---|---|---|---|
| `apiUrl` | `string` | — | Dakera server URL **(required)** |
| `apiKey` | `string` | — | Dakera API key; omit for a server running without auth |
| `namespace` | `string` | — | Namespace to read and write **(required)** |
| `embeddingModel` | `string` | server default | Server-side embedding model for writes and searches (`"bge-large"`, `"minilm"`, …); use one model per namespace |
| `embeddings` | `Embeddings` | — | Accepted where LangChain passes one; never called |

### Retrieval-augmented generation

```typescript
import type { Document } from "@langchain/core/documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { DakeraVectorStore } from "@dakera-ai/langchain";

const vectorStore = new DakeraVectorStore({ apiUrl: "http://localhost:3000", apiKey: "dk-mykey", namespace: "my-docs" });
const retriever = vectorStore.asRetriever({ k: 4 });

const prompt = ChatPromptTemplate.fromTemplate(
  "Answer from the context only.\n\nContext:\n{context}\n\nQuestion: {question}",
);
const formatDocs = (docs: Document[]) => docs.map((d) => d.pageContent).join("\n\n");

const rag = RunnableSequence.from([
  { context: retriever.pipe(formatDocs), question: new RunnablePassthrough() },
  prompt,
  new ChatOpenAI({ model: "gpt-4o-mini" }),
  new StringOutputParser(),
]);

console.log(await rag.invoke("Which SDKs does Dakera have?"));
```

### From texts

```typescript
import { DakeraVectorStore } from "@dakera-ai/langchain";

const store = await DakeraVectorStore.fromTexts(
  ["Document one content", "Document two content"],
  [{ source: "a" }, { source: "b" }],
  null as never, // embeddings — not used, Dakera embeds on the server
  { apiUrl: "http://localhost:3000", apiKey: "dk-mykey", namespace: "docs" },
);
```

### Full-text and hybrid search

```typescript
import { DakeraVectorStore } from "@dakera-ai/langchain";

const vectorStore = new DakeraVectorStore({ apiUrl: "http://localhost:3000", apiKey: "dk-mykey", namespace: "my-docs" });

const keyword = await vectorStore.fulltextSearch("SDKs", 5); // BM25
const hybrid = await vectorStore.hybridSearch("SDKs", 5);
console.log(keyword.map((d) => d.metadata), hybrid.map((d) => d.metadata)); // [{ score, id }, ...]
```

Both return only each match's `id` and `score` in `metadata` — **not its text or metadata** (`pageContent` is
empty; look the documents up by id). The server's BM25 index keeps no metadata, so a `filter` matches nothing
here: filter with `similaritySearch`. `hybridSearch` sends the query text without a query vector, so the server
ranks it by BM25 and `alpha` has no effect; use `similaritySearch` for semantic ranking.

## DakeraSessionManager

Groups an agent's memories into conversation sessions. The server ends a session after 4 hours without
activity by default (`endedReason: "idle"`); `start()` sets a per-session timeout and `touch()` records
activity.

```typescript
import { DakeraMemory, DakeraSessionManager } from "@dakera-ai/langchain";

const conn = { apiUrl: "http://localhost:3000", apiKey: "dk-mykey" };
const sessions = new DakeraSessionManager({ ...conn, agentId: "my-agent" });

const sessionId = await sessions.start({ channel: "web" }, { idleTimeoutSecs: 30 * 60 });
const memory = new DakeraMemory({ ...conn, agentId: "my-agent", sessionId }); // turns go into the session

await memory.saveContext({ input: "Hi, I need help with billing." }, { output: "Sure, what's up?" });
await sessions.touch();                     // false once the session has ended
console.log(await sessions.memories(sessionId));

await sessions.end("Resolved a billing question");
const info = await sessions.get(sessionId); // { summary, endedReason: "client", memoryCount, ... }
console.log(info.summary, info.endedReason);
```

| Method | Returns | Description |
|---|---|---|
| `start(metadata?, { idleTimeoutSecs? })` | `string` | Opens a session and makes it the current one (`0` = never idle-ends) |
| `touch()` | `boolean` | Records activity on the current session; `false` once it has ended (server v0.12.2+) |
| `end(summary?)` | `void` | Ends the current session, storing the summary |
| `get(sessionId)` | `SessionInfo` | `id`, `agentId`, `startedAt`, `endedAt`, `metadata`, `memoryCount`, `summary`, `endedReason` |
| `list(activeOnly?)` | `SessionInfo[]` | The agent's sessions |
| `memories(sessionId)` | `SessionMemory[]` | The memories stored in a session |
| `currentSessionId` | `string \| null` | The session `start()` opened and `end()` has not closed |

## DakeraKnowledgeGraph

The server links related memories of an agent into a graph. Query it, link memories explicitly, build the
graph around a memory and summarize memories into a new one.

```typescript
import { DakeraClient } from "@dakera-ai/dakera";
import { DakeraKnowledgeGraph } from "@dakera-ai/langchain";

const client = new DakeraClient({ baseUrl: "http://localhost:3000", apiKey: "dk-mykey" });
const kg = new DakeraKnowledgeGraph({ apiUrl: "http://localhost:3000", apiKey: "dk-mykey", agentId: "my-agent" });

const a = await client.storeMemory("my-agent", { content: "Alice leads the payments team in Berlin." });
const b = await client.storeMemory("my-agent", { content: "The payments team ships checkout in March." });

await kg.link(a.memory.id, b.memory.id, "same team");
const graph = await kg.build(a.memory.id, { depth: 2 }); // the graph around a seed memory
const { edges, edgeCount } = await kg.query({ maxDepth: 3, limit: 50 });
const summary = await kg.summarize([a.memory.id, b.memory.id]); // stores a summary memory
console.log(graph, edgeCount, edges.length, summary.summary_memory.content);
```

| Method | Returns | Description |
|---|---|---|
| `query({ rootId?, edgeType?, maxDepth?, limit? })` | `GraphResult` | Edges of the agent's graph, `nodeCount`, `edgeCount` |
| `link(fromId, toId, relation?)` | `void` | Links two memories (`relation` is an informational label) |
| `path(fromId, toId)` | server answer | Shortest path between two memories |
| `build(memoryId, { depth?, minSimilarity? })` | server answer | The graph around a seed memory (`{ root, total_nodes }`) |
| `summarize(memoryIds, { targetType? })` | `KnowledgeSummary` | Stores a summary of at least two memories |
| `export(format?)` | `GraphResult` | The whole graph |
| `deduplicate()` | server answer | Merges the agent's near-duplicate memories |

## DakeraEntityExtractor

```typescript
import { DakeraEntityExtractor } from "@dakera-ai/langchain";

const extractor = new DakeraEntityExtractor({ apiUrl: "http://localhost:3000", apiKey: "dk-mykey", agentId: "my-agent" });

const entities = await extractor.extract("Email alice@example.com about the launch on March 1, 2026.");
// [{ type: "email", value: "alice@example.com", confidence: 1 },
//  { type: "date", value: "March 1, 2026", confidence: 1 }]
console.log(entities);

// Tag the agent's new memories with people, organisations and places.
await extractor.configure(["person", "organization", "location"]);
```

`extract()` runs the server's built-in rule-based extractor (dates, emails, URLs and similar). Named types —
people, organisations, places — come from the server's neural extractor, which `configure(entityTypes)` turns
on for the agent's memories; `memoryEntities(memoryId)` then returns what was extracted from a stored memory.

## DakeraNamespaceManager

```typescript
import { DakeraNamespaceManager } from "@dakera-ai/langchain";

const ns = new DakeraNamespaceManager({ apiUrl: "http://localhost:3000", apiKey: "dk-mykey" });

await ns.create("products", { dimensions: 1024, distance: "cosine" });
const info = await ns.get("products"); // { name, dimension, vectorCount, kind: "data" }
const vectorNamespaces = (await ns.list()).filter((n) => n.kind === "data");
console.log(info, vectorNamespaces.map((n) => n.name));
await ns.delete("products");
```

`list()` returns names and kinds (`"data"`, `"agent"`, `"system"`); `get()` adds the dimension and vector
count. `configure(name, { dimension, distance })` and `stats(name)` are available too.

## DakeraAgentTools

```typescript
import { DakeraAgentTools } from "@dakera-ai/langchain";

const agent = new DakeraAgentTools({ apiUrl: "http://localhost:3000", apiKey: "dk-mykey", agentId: "my-agent" });

const job = await agent.importMemories([
  { content: "The customer prefers email.", importance: 0.8, tags: ["preference"] },
  { content: "The contract renews in January." }, // only `content` is required
]);
console.log(job.status, job.imported);

const recent = await agent.memories({ limit: 20 }); // newest first
const backup = await agent.exportMemories();        // JSON lines, re-importable
console.log(recent.length, backup.length, await agent.stats());
```

`sessions(activeOnly?)` lists the agent's sessions.

## Configuration

Every class takes the connection in its options — the package reads no environment variables, so pass them
from your own configuration:

| Option | Description |
|---|---|
| `apiUrl` | Dakera server URL — `http://localhost:3000` for the quick start |
| `apiKey` | A key the server accepts: its `DAKERA_ROOT_API_KEY`, or a scoped key created with the admin API. Omit it for a server running with `DAKERA_AUTH_ENABLED=false` |
| `agentId` | The agent (memory owner) for `DakeraMemory`, sessions, the knowledge graph, entities and agent tools — typically one per end user or assistant |

The [examples](#examples) read `DAKERA_API_URL` and `DAKERA_API_KEY`. Keep the API key on the server side:
never ship it in a browser bundle.

Calls throw the typed errors of `@dakera-ai/dakera` — `AuthenticationError`, `NotFoundError`,
`ValidationError`, `RateLimitError` and the others, all subclasses of `DakeraError`:

```typescript
import { DakeraError, NotFoundError } from "@dakera-ai/dakera";
import { DakeraSessionManager } from "@dakera-ai/langchain";

const sessions = new DakeraSessionManager({ apiUrl: "http://localhost:3000", apiKey: "dk-mykey", agentId: "my-agent" });
try {
  await sessions.get("sess_does_not_exist");
} catch (err) {
  if (err instanceof NotFoundError) console.log("no such session");
  else if (err instanceof DakeraError) console.log(err.statusCode, err.message);
  else throw err;
}
```

The client retries `429` and `503` answers for every call, and other server errors, timeouts and network
errors for reads only: a store that failed with a `500` or timed out is not sent again, so a turn is never
stored twice.

## Examples

Runnable scripts in [`examples/`](https://github.com/Dakera-AI/dakera-langchain-js/tree/main/examples) —
none needs an LLM API key (`chat_chain.ts` uses LangChain's fake chat model). Run them from a clone with
`npm install && npm run build && DAKERA_API_KEY=dk-mykey npx tsx examples/basic_memory.ts`.

| File | What it shows | LLM key? |
|---|---|---|
| [`basic_memory.ts`](https://github.com/Dakera-AI/dakera-langchain-js/blob/main/examples/basic_memory.ts) | `DakeraMemory`: store turns, recall the relevant ones | No |
| [`chat_chain.ts`](https://github.com/Dakera-AI/dakera-langchain-js/blob/main/examples/chat_chain.ts) | `DakeraMemory` in an LCEL chat chain | No (fake model) |
| [`rag_pipeline.ts`](https://github.com/Dakera-AI/dakera-langchain-js/blob/main/examples/rag_pipeline.ts) | `DakeraVectorStore`: index, semantic search, retriever | No |
| [`hybrid_search.ts`](https://github.com/Dakera-AI/dakera-langchain-js/blob/main/examples/hybrid_search.ts) | Metadata filters, BM25 and hybrid search | No |
| [`sessions.ts`](https://github.com/Dakera-AI/dakera-langchain-js/blob/main/examples/sessions.ts) | Sessions: start, store turns, `touch()`, end with a summary | No |
| [`knowledge_graph.ts`](https://github.com/Dakera-AI/dakera-langchain-js/blob/main/examples/knowledge_graph.ts) | Link, export, query, build, summarize | No |
| [`entities.ts`](https://github.com/Dakera-AI/dakera-langchain-js/blob/main/examples/entities.ts) | Extract entities, turn on extraction for an agent | No |
| [`namespaces.ts`](https://github.com/Dakera-AI/dakera-langchain-js/blob/main/examples/namespaces.ts) | Create, read, list, delete namespaces | No |
| [`agent_tools.ts`](https://github.com/Dakera-AI/dakera-langchain-js/blob/main/examples/agent_tools.ts) | Import, list, stats, export | No |

`sessions.ts` and `entities.ts` need a v0.12.2 server or later.

## Troubleshooting

**`ECONNREFUSED` / `fetch failed`** — no server at `apiUrl`. The quick start publishes port **3000**; this
repository's CI runs the server on 3300. Check with `curl http://localhost:3000/health`.

**`AuthenticationError` (401)** — `apiKey` is missing or not a key the server accepts (e.g. its
`DAKERA_ROOT_API_KEY`).

**`history` is empty** — expected for an agent that has stored nothing yet. Servers before v0.12.3 answer a
recall for such an agent with `404 NAMESPACE_NOT_FOUND`; `DakeraMemory` treats that as "no memories", so the
first turn of a new agent works on every v0.12 server.

**Fewer memories than expected in `history`** — `recallK` is a hard limit, and `minImportance` filters out
less important memories. The server's session-neighbourhood context is deliberately left out.

**`touch()` or `configure()` fails with 404** — they need a v0.12.2 server or later.

**`fulltextSearch()` / `hybridSearch()` documents have no text, or a filter returns nothing** — the server's
BM25 and hybrid routes return ids and scores only, and its BM25 index keeps no metadata to filter on; fetch the
documents by `metadata.id`, or use `similaritySearch()` (which takes filters).

**`Cannot find module 'langchain/chains'`** — LangChain v1 moved the legacy chains to `@langchain/classic`
(see [Legacy chains](#legacy-chains)).

## Development

```bash
npm install
npm run build && npm run lint && npm run typecheck && npm test
DAKERA_API_URL=http://localhost:3000 DAKERA_API_KEY=dk-mykey npm test   # + live tests against a server
```

See [CONTRIBUTING](https://github.com/Dakera-AI/dakera-langchain-js/blob/main/CONTRIBUTING.md).

## Related packages

| Package | What it is |
|---|---|
| [`dakera`](https://pypi.org/project/dakera/) · [`@dakera-ai/dakera`](https://www.npmjs.com/package/@dakera-ai/dakera) · [`dakera-client`](https://crates.io/crates/dakera-client) · [`dakera-go`](https://github.com/Dakera-AI/dakera-go) | Python, TypeScript, Rust and Go SDKs |
| [`langchain-dakera`](https://pypi.org/project/langchain-dakera/) | LangChain (Python): memory, vector store, sessions, knowledge graph |
| **[`@dakera-ai/langchain`](https://www.npmjs.com/package/@dakera-ai/langchain)** | **LangChain.js: memory, vector store, sessions, knowledge graph** |
| [`llamaindex-dakera`](https://pypi.org/project/llamaindex-dakera/) | LlamaIndex: memory block, vector store, memory store |
| [`autogen-dakera`](https://pypi.org/project/autogen-dakera/) | AutoGen: `Memory` for `AssistantAgent`, sessions, knowledge graph |
| [`crewai-dakera`](https://pypi.org/project/crewai-dakera/) | CrewAI: storage for a crew's memories |
| [`strands-dakera`](https://pypi.org/project/strands-dakera/) | Strands Agents: memory tool and `MemoryStore` |
| [`@dakera-ai/ai-sdk`](https://www.npmjs.com/package/@dakera-ai/ai-sdk) | Vercel AI SDK: memory middleware and tools |

## Links

- [dakera.ai](https://dakera.ai) · [Documentation](https://dakera.ai/docs) ·
  [LangChain.js guide](https://dakera.ai/integrations/langchain-js.html) ·
  [Benchmark](https://dakera.ai/benchmark)
- Deploy: [dakera-deploy](https://github.com/Dakera-AI/dakera-deploy) (Docker Compose, Kubernetes) ·
  [dakera-helm](https://github.com/Dakera-AI/dakera-helm) · server image `ghcr.io/dakera-ai/dakera`
- Tools: [dakera-mcp](https://github.com/Dakera-AI/dakera-mcp) (MCP server) ·
  [dakera-cli](https://github.com/Dakera-AI/dakera-cli) (`dk` CLI)
- [Issues](https://github.com/Dakera-AI/dakera-langchain-js/issues) ·
  [Changelog](https://github.com/Dakera-AI/dakera-langchain-js/blob/main/CHANGELOG.md) ·
  [Security policy](https://github.com/Dakera-AI/dakera-langchain-js/blob/main/.github/SECURITY.md)

## License

[MIT](https://github.com/Dakera-AI/dakera-langchain-js/blob/main/LICENSE) © [Dakera AI](https://dakera.ai)

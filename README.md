# @dakera-ai/langchain

[![CI](https://github.com/Dakera-AI/dakera-langchain-js/actions/workflows/ci.yml/badge.svg)](https://github.com/Dakera-AI/dakera-langchain-js/actions/workflows/ci.yml)
[![Integration](https://github.com/Dakera-AI/dakera-langchain-js/actions/workflows/integration.yml/badge.svg)](https://github.com/Dakera-AI/dakera-langchain-js/actions/workflows/integration.yml)
[![npm](https://img.shields.io/npm/v/@dakera-ai/langchain)](https://www.npmjs.com/package/@dakera-ai/langchain)
[![Downloads](https://img.shields.io/npm/dm/@dakera-ai/langchain)](https://www.npmjs.com/package/@dakera-ai/langchain)
[![Node](https://img.shields.io/node/v/@dakera-ai/langchain)](https://www.npmjs.com/package/@dakera-ai/langchain)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-dakera.ai-3b82f6)](https://dakera.ai/docs)

**LangChain.js integration for [Dakera](https://dakera.ai) — persistent, decay-weighted memory and
server-side vector search for your chains and agents. Dakera embeds on the server: no embeddings API key,
no local model.**

| Class | What it does |
|-------|--------------|
| [`DakeraMemory`](#dakeramemory) | LangChain `BaseMemory`: recalls the turns most relevant to each input, stores every turn |
| [`DakeraVectorStore`](#dakeravectorstore) | LangChain `VectorStore` / retriever over a Dakera namespace |
| [`DakeraSessionManager`](#dakerasessionmanager) | Conversation sessions: start, keep alive, end with a summary |
| [`DakeraKnowledgeGraph`](#dakeraknowledgegraph) | The agent's memory graph: links, traversal, summaries |
| [`DakeraEntityExtractor`](#dakeraentityextractor) | Named-entity extraction with the server's built-in model |
| [`DakeraNamespaceManager`](#dakeranamespacemanager) | Create, inspect and delete vector namespaces |
| [`DakeraAgentTools`](#dakeraagenttools) | Agent statistics, memory listing, JSON-lines import / export |

---

## Quick start

### 1. Run Dakera

Dakera is a self-hosted memory server:

```bash
docker run -d \
  --name dakera \
  -p 3000:3000 \
  -e DAKERA_ROOT_API_KEY=dk-mykey \
  ghcr.io/dakera-ai/dakera:0.12.3

curl http://localhost:3000/health  # → {"service":"dakera","status":"healthy","version":"0.12.3",...}
```

Persistent storage, Docker Compose, Kubernetes and Helm: see the deployment guide,
[dakera-deploy](https://github.com/Dakera-AI/dakera-deploy).

### 2. Install

```bash
npm install @dakera-ai/langchain @dakera-ai/dakera @langchain/core
```

`@dakera-ai/dakera` (the Dakera client) and `@langchain/core` are peer dependencies. Add the chat-model
package you use, e.g. `npm install @langchain/openai`.

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
console.log(await chat("What language is my project written in?"));
```

---

## Compatibility

| | Version |
|---|---|
| Dakera server | **v0.12.3** (v0.12.0 – v0.12.2 work too, see below) |
| `@dakera-ai/dakera` | `^0.12.3` |
| `@langchain/core` | `>=1.1.0` |
| Node.js | `>=20` |

On servers older than v0.12.2, `DakeraSessionManager.touch()` and `DakeraEntityExtractor.configure()` for an
agent that has stored nothing yet are not available.

---

## DakeraMemory

A LangChain.js `BaseMemory`. `loadMemoryVariables({ input })` recalls the agent's memories most relevant to
the input — semantic search weighted by importance and recency — and returns them under `memoryKey`;
`saveContext(inputs, outputs)` stores the turn (`Human: …\nAI: …`) as one memory. Memories live on the
Dakera server, so they persist across processes and restarts.

```typescript
import { DakeraMemory } from "@dakera-ai/langchain";

const memory = new DakeraMemory({
  apiUrl: "http://localhost:3000",
  apiKey: process.env.DAKERA_API_KEY,
  agentId: "user-42",            // one agent per user or assistant
  recallK: 5,                     // memories recalled per turn
  importance: 0.7,                // importance of stored turns (0 – 1)
});

await memory.saveContext({ input: "I prefer metric units." }, { output: "Noted!" });
const { history } = await memory.loadMemoryVariables({ input: "Which units do I like?" });
console.log(history);
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | `string` | — | Dakera server URL, e.g. `http://localhost:3000` **(required)** |
| `apiKey` | `string` | — | Dakera API key; omit for a server running without auth |
| `agentId` | `string` | — | Agent whose memories are stored and recalled **(required)** |
| `recallK` | `number` | `5` | Maximum memories recalled per turn |
| `minImportance` | `number` | `0` | Recall only memories at least this important (0 – 1) |
| `importance` | `number` | `0.7` | Importance assigned to stored turns (0 – 1) |
| `memoryKey` | `string` | `"history"` | Prompt variable the recalled memories fill |
| `inputKey` | `string` | first input key | Input used as the recall query |
| `sessionId` | `string` | — | Session the stored turns belong to (see [`DakeraSessionManager`](#dakerasessionmanager)) |

`history` holds at most `recallK` memories, best first, one memory's text after another. A server v0.12.3
can add the session's neighbouring memories as extra context; `DakeraMemory` asks for that context
separately and leaves it out, so `recallK` is a hard limit. `clear()` is a no-op: Dakera memories are
persistent (delete them with the `@dakera-ai/dakera` client).

### Classic chains

`ConversationChain` and the other legacy chains moved to `@langchain/classic` in LangChain v1. They take
`DakeraMemory` as their `memory`:

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

---

## DakeraVectorStore

A LangChain.js `VectorStore` over a Dakera namespace. The server embeds documents and queries, so there is
no `Embeddings` instance to configure. Results carry the document's `id` and similarity `score` in
`metadata`.

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

### Retrieval-augmented generation

```typescript
import type { Document } from "@langchain/core/documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { DakeraVectorStore } from "@dakera-ai/langchain";

const vectorStore = new DakeraVectorStore({
  apiUrl: "http://localhost:3000",
  apiKey: "dk-mykey",
  namespace: "my-docs",
});
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

`fulltextSearch(query, k)` ranks by BM25 and `hybridSearch(query, k, { filter })` calls the server's hybrid
endpoint. Both return each match's `id` and `score` in `metadata` but **not its text** (`pageContent` is
empty): look the documents up by id. `hybridSearch` sends the query text without a query vector, so the
server ranks it by BM25 and `alpha` has no effect; use `similaritySearch` for semantic ranking.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | `string` | — | Dakera server URL **(required)** |
| `apiKey` | `string` | — | Dakera API key; omit for a server running without auth |
| `namespace` | `string` | — | Namespace to read and write **(required)** |
| `embeddingModel` | `string` | server default | Server-side embedding model for writes and searches (`"bge-large"`, `"minilm"`, …); use one model per namespace |

---

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

`list(activeOnly?)` lists the agent's sessions; `currentSessionId` is the session `start()` opened and
`end()` has not closed.

---

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

`path(fromId, toId)`, `export()` and `deduplicate()` are available too. `build()` needs the seed memory id
and `summarize()` at least two memory ids.

---

## DakeraEntityExtractor

```typescript
import { DakeraEntityExtractor } from "@dakera-ai/langchain";

const extractor = new DakeraEntityExtractor({
  apiUrl: "http://localhost:3000",
  apiKey: "dk-mykey",
  agentId: "my-agent",
});

const entities = await extractor.extract("Email alice@example.com about the launch on March 1, 2026.");
// [{ type: "email", value: "alice@example.com", confidence: 1 },
//  { type: "date", value: "March 1, 2026", confidence: 1 }]
console.log(entities);

// Tag the agent's new memories with people, organisations and places.
await extractor.configure(["person", "organization", "location"]);
```

`extract()` runs the server's built-in rule-based extractor (dates, emails, URLs and similar). Named types —
people, organisations, places — come from the server's neural extractor, which `configure(entityTypes)`
turns on for the agent's memories; `memoryEntities(memoryId)` then returns what was extracted from a
stored memory.

---

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

---

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
const backup = await agent.exportMemories();       // JSON lines, re-importable
console.log(recent.length, backup.length, await agent.stats());
```

`sessions(activeOnly?)` lists the agent's sessions.

---

## Errors

Calls throw the typed errors of `@dakera-ai/dakera` — `AuthenticationError`, `NotFoundError`,
`ValidationError`, `RateLimitError` and the others, all subclasses of `DakeraError` — so you can handle them
by class:

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

---

## Examples

Runnable examples are in [`examples/`](examples/) — memory, an LCEL chat chain, retrieval, full-text search,
sessions, the knowledge graph, entities, namespaces and agent tools. See
[`examples/README.md`](examples/README.md).

---

## Related packages

| Package | Framework | Language |
|---------|-----------|----------|
| [`@dakera-ai/dakera`](https://github.com/Dakera-AI/dakera-js) | — (Dakera client) | TypeScript |
| [`@dakera-ai/ai-sdk`](https://github.com/Dakera-AI/dakera-ai-sdk) | Vercel AI SDK | TypeScript |
| [`langchain-dakera`](https://pypi.org/project/langchain-dakera/) | LangChain | Python |
| [`llamaindex-dakera`](https://pypi.org/project/llamaindex-dakera/) | LlamaIndex | Python |
| [`crewai-dakera`](https://pypi.org/project/crewai-dakera/) | CrewAI | Python |
| [`autogen-dakera`](https://pypi.org/project/autogen-dakera/) | AutoGen | Python |
| [`strands-dakera`](https://pypi.org/project/strands-dakera/) | Strands Agents | Python |

---

## Links

- [Dakera documentation](https://dakera.ai/docs)
- [LangChain.js integration guide](https://dakera.ai/integrations/langchain-js.html)
- [All integrations](https://dakera.ai/integrations/)
- [Deployment guide](https://github.com/Dakera-AI/dakera-deploy)
- [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [Security](.github/SECURITY.md)

---

## License

MIT © [Dakera AI](https://dakera.ai)

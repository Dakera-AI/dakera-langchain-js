# @dakera-ai/langchain

[![CI](https://github.com/Dakera-AI/dakera-langchain-js/actions/workflows/ci.yml/badge.svg)](https://github.com/Dakera-AI/dakera-langchain-js/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@dakera-ai/langchain)](https://www.npmjs.com/package/@dakera-ai/langchain)
[![Downloads](https://img.shields.io/npm/dm/@dakera-ai/langchain)](https://www.npmjs.com/package/@dakera-ai/langchain)
[![Node](https://img.shields.io/node/v/@dakera-ai/langchain)](https://www.npmjs.com/package/@dakera-ai/langchain)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![dakera.ai](https://img.shields.io/badge/dakera.ai-website-22c55e?style=flat-square)](https://dakera.ai) [![Docs](https://img.shields.io/badge/docs-dakera.ai%2Fdocs-3b82f6?style=flat-square)](https://dakera.ai/docs)
[![Docs](https://img.shields.io/badge/docs-dakera.ai-D4A843)](https://dakera.ai/docs)

**LangChain.js integration for [Dakera](https://github.com/Dakera-AI/dakera-deploy) — persistent semantic memory and server-side vector search, no local embedding model required.**

| Class | Description |
|-------|-------------|
| `DakeraMemory` | Drop-in `BaseMemory` for LangChain.js conversation chains |
| `DakeraVectorStore` | `VectorStore` backed by Dakera's server-side embedding engine |

---

## Quick Start

### Step 1 — Run Dakera

Dakera is a self-hosted memory server. Spin it up with Docker:

```bash
docker run -d \
  --name dakera \
  -p 3300:3300 \
  -e DAKERA_ROOT_API_KEY=dk-mykey \
  ghcr.io/dakera-ai/dakera:latest
```

For a production setup with persistent storage, use Docker Compose:

```bash
curl -sSfL https://raw.githubusercontent.com/Dakera-AI/dakera-deploy/main/docker-compose.yml \
  -o docker-compose.yml
DAKERA_API_KEY=dk-mykey docker compose up -d

curl http://localhost:3300/health  # → {"status":"ok"}
```

> Full deployment guide: [github.com/Dakera-AI/dakera-deploy](https://github.com/Dakera-AI/dakera-deploy)

### Step 2 — Install the integration

```bash
npm install @dakera-ai/langchain @dakera-ai/dakera @langchain/core
```

### Step 3 — Use it

```typescript
import { DakeraMemory } from "@dakera-ai/langchain";
import { ConversationChain } from "langchain/chains";
import { ChatOpenAI } from "@langchain/openai";

const memory = new DakeraMemory({
  apiUrl: "http://localhost:3300",
  apiKey: "dk-mykey",
  agentId: "my-agent",
});

const chain = new ConversationChain({
  llm: new ChatOpenAI({ model: "gpt-4o" }),
  memory,
});

// Memory persists across sessions and restarts
const response = await chain.call({ input: "My project is called NeuralBridge." });
console.log(response.response);
```

---

## Installation

```bash
npm install @dakera-ai/langchain @dakera-ai/dakera @langchain/core
```

**Requirements:** Node.js ≥ 20, a running Dakera server (see Step 1 above)

---

## DakeraMemory

Persistent conversation memory for LangChain.js chains. Stores and recalls conversation history using Dakera's hybrid search.

```typescript
import { DakeraMemory } from "@dakera-ai/langchain";
import { ConversationChain } from "langchain/chains";
import { ChatOpenAI } from "@langchain/openai";

const memory = new DakeraMemory({
  apiUrl: "http://localhost:3300",
  apiKey: process.env.DAKERA_API_KEY!,
  agentId: "my-agent",
  recallK: 5,       // how many past memories to surface per turn
  importance: 0.7,  // importance score for stored memories
});

const chain = new ConversationChain({
  llm: new ChatOpenAI({ model: "gpt-4o" }),
  memory,
});

// First session
await chain.call({ input: "My name is Alice and I'm building a chatbot." });

// Later session — memory persists across restarts
const { response } = await chain.call({ input: "What was I building?" });
console.log(response); // "You mentioned you were building a chatbot."
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | `string` | — | Dakera server URL (e.g. `http://localhost:3300`) |
| `apiKey` | `string` | `""` | Dakera API key |
| `agentId` | `string` | — | Agent identifier for memory namespacing |
| `recallK` | `number` | `5` | Number of memories to recall per turn |
| `minImportance` | `number` | `0` | Minimum importance threshold for recall |
| `memoryKey` | `string` | `"history"` | Key injected into the chain prompt |
| `inputKey` | `string` | first key | Input key used as recall query |
| `importance` | `number` | `0.7` | Importance score assigned to stored memories |

---

## DakeraVectorStore

Server-side embedded vector store for RAG. Dakera handles embeddings — no local model, no OpenAI embeddings API needed.

```typescript
import { DakeraVectorStore } from "@dakera-ai/langchain";

const vectorstore = new DakeraVectorStore({
  apiUrl: "http://localhost:3300",
  apiKey: process.env.DAKERA_API_KEY!,
  namespace: "my-docs",
});

// Index documents (server handles embedding)
await vectorstore.addDocuments([
  { pageContent: "Dakera is a persistent memory platform for AI agents.", metadata: { source: "docs" } },
  { pageContent: "It supports Python, JavaScript, Rust, and Go SDKs.", metadata: { source: "docs" } },
]);

// Semantic search
const results = await vectorstore.similaritySearch("What languages are supported?", 4);
console.log(results[0].pageContent);
```

### RAG chain

```typescript
import { RetrievalQAChain } from "langchain/chains";
import { ChatOpenAI } from "@langchain/openai";
import { DakeraVectorStore } from "@dakera-ai/langchain";

const vectorstore = new DakeraVectorStore({
  apiUrl: "http://localhost:3300",
  apiKey: process.env.DAKERA_API_KEY!,
  namespace: "my-docs",
});

const chain = RetrievalQAChain.fromLLM(
  new ChatOpenAI({ model: "gpt-4o" }),
  vectorstore.asRetriever({ k: 4 }),
);

const { text } = await chain.call({ query: "How does memory decay work?" });
console.log(text);
```

### From texts (LangChain convention)

```typescript
const store = await DakeraVectorStore.fromTexts(
  ["Document one content", "Document two content"],
  [{ source: "a" }, { source: "b" }],
  null, // embeddings param — unused, Dakera handles server-side embedding
  { apiUrl: "http://localhost:3300", apiKey: "dk-mykey", namespace: "docs" },
);
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | `string` | — | Dakera server URL |
| `apiKey` | `string` | `""` | Dakera API key |
| `namespace` | `string` | — | Vector namespace to read/write |
| `embeddingModel` | `string` | namespace default | Server-side embedding model override |

---

## Related packages

| Package | Framework | Language |
|---------|-----------|----------|
| `langchain-dakera` | LangChain | Python |
| `crewai-dakera` | CrewAI | Python |
| `llamaindex-dakera` | LlamaIndex | Python |
| `autogen-dakera` | AutoGen | Python |

---

## Links

- [Dakera Server](https://github.com/Dakera-AI/dakera-deploy) — self-hosted memory server
- [Dakera JS SDK](https://github.com/Dakera-AI/dakera-js) — low-level API client
- [Integration guide](https://dakera.ai/integrations/langchain-js.html) — full setup walkthrough
- [All integrations](https://dakera.ai/integrations/)

---

## License

MIT © [Dakera AI](https://dakera.ai)

---

<div align="center">

**[dakera.ai](https://dakera.ai)** · [Documentation](https://dakera.ai/docs) · [Request Early Access](https://dakera.ai#cta)

</div>

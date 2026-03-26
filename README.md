# @dakera-ai/langchain

LangChain.js integration for the [Dakera AI](https://dakera.ai) memory platform.

Provides **persistent semantic memory** and **server-side vector search** for LangChain.js agents — no local embedding model required.

## Packages

| Class | Description |
|-------|-------------|
| `DakeraMemory` | Drop-in `BaseMemory` for LangChain.js conversation chains |
| `DakeraVectorStore` | `VectorStore` backed by Dakera's server-side embedding engine |

## Installation

```bash
npm install @dakera-ai/langchain @dakera-ai/dakera @langchain/core
```

## DakeraMemory

Stores and recalls conversation turns via Dakera's semantic memory platform.

```typescript
import { DakeraMemory } from "@dakera-ai/langchain";
import { ConversationChain } from "langchain/chains";
import { ChatOpenAI } from "@langchain/openai";

const memory = new DakeraMemory({
  apiUrl: "https://api.dakera.ai",
  apiKey: process.env.DAKERA_API_KEY,
  agentId: "my-agent",
  recallK: 5,          // how many past memories to recall per turn
  importance: 0.7,     // importance score assigned to new memories
});

const chain = new ConversationChain({
  llm: new ChatOpenAI(),
  memory,
});

const response = await chain.call({ input: "What did we discuss earlier?" });
console.log(response.response);
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | `string` | — | Dakera API base URL |
| `apiKey` | `string` | `""` | Dakera API key |
| `agentId` | `string` | — | Agent identifier for memory storage |
| `recallK` | `number` | `5` | Number of memories to recall per turn |
| `minImportance` | `number` | `0` | Minimum importance threshold for recall |
| `memoryKey` | `string` | `"history"` | Key injected into chain prompt |
| `inputKey` | `string` | first key | Input key to use as recall query |
| `importance` | `number` | `0.7` | Importance score for stored memories |

## DakeraVectorStore

Server-side embedded vector store for RAG pipelines.

```typescript
import { DakeraVectorStore } from "@dakera-ai/langchain";

const vectorstore = new DakeraVectorStore({
  apiUrl: "https://api.dakera.ai",
  apiKey: process.env.DAKERA_API_KEY,
  namespace: "my-docs",
});

// Index documents
await vectorstore.addDocuments([
  { pageContent: "Dakera is a persistent memory platform for AI agents.", metadata: { source: "docs" } },
]);

// Search
const results = await vectorstore.similaritySearch("What is Dakera?", 4);
console.log(results[0].pageContent);

// From texts (LangChain convention)
const store = await DakeraVectorStore.fromTexts(
  ["Document one", "Document two"],
  [{ source: "a" }, { source: "b" }],
  null,               // embeddings param — unused, Dakera handles server-side embedding
  { apiUrl: "...", apiKey: "...", namespace: "docs" },
);
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | `string` | — | Dakera API base URL |
| `apiKey` | `string` | `""` | Dakera API key |
| `namespace` | `string` | — | Vector namespace to read/write |
| `embeddingModel` | `string` | namespace default | Server-side embedding model override |

## Requirements

- Node.js ≥ 20
- `@dakera-ai/dakera` ≥ 0.8.6
- `@langchain/core` ≥ 0.2.0

## License

MIT

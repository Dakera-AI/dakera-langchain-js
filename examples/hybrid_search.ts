/**
 * Semantic and BM25 full-text search with DakeraVectorStore.
 *
 * `similaritySearch` ranks by meaning (the server embeds the query);
 * `fulltextSearch` ranks by BM25 keyword relevance. Full-text and hybrid
 * results carry the document `id` and `score` in `metadata` but not the text,
 * so the example maps ids back to the documents it indexed.
 *
 * Run from the repository root, with a Dakera server running:
 *   npm install && npm run build
 *   DAKERA_API_URL=http://localhost:3000 DAKERA_API_KEY=dk-mykey npx tsx examples/hybrid_search.ts
 */

import { Document } from "@langchain/core/documents";
import { DakeraVectorStore } from "@dakera-ai/langchain";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3000";
const apiKey = process.env.DAKERA_API_KEY;

const store = new DakeraVectorStore({
  apiUrl,
  ...(apiKey ? { apiKey } : {}),
  namespace: "examples-hybrid",
});

const docs: Record<string, Document> = {
  python: new Document({ pageContent: "Python is a high-level programming language.", metadata: { lang: "python" } }),
  rust: new Document({ pageContent: "Rust provides memory safety without garbage collection.", metadata: { lang: "rust" } }),
  typescript: new Document({ pageContent: "TypeScript adds static types to JavaScript.", metadata: { lang: "typescript" } }),
  go: new Document({ pageContent: "Go is designed for concurrent systems programming.", metadata: { lang: "go" } }),
  fastapi: new Document({ pageContent: "FastAPI is a modern Python web framework.", metadata: { lang: "python" } }),
};

function text(doc: Document): string {
  const id = String(doc.metadata.id ?? "");
  return docs[id]?.pageContent ?? id;
}

async function main() {
  console.log("Indexing documents...");
  await store.addDocuments(Object.values(docs), { ids: Object.keys(docs) });

  console.log("\n--- Semantic search: 'memory safe language' ---");
  for (const doc of await store.similaritySearch("memory safe language", 3)) {
    console.log(`  [${Number(doc.metadata.score).toFixed(3)}] ${doc.pageContent}`);
  }

  console.log("\n--- Semantic search with a metadata filter: lang = python ---");
  for (const doc of await store.similaritySearch("web development", 2, { lang: { $eq: "python" } })) {
    console.log(`  [${Number(doc.metadata.score).toFixed(3)}] ${doc.pageContent}`);
  }

  console.log("\n--- Full-text BM25: 'concurrent systems' ---");
  for (const doc of await store.fulltextSearch("concurrent systems", 3)) {
    console.log(`  [${Number(doc.metadata.score).toFixed(3)}] ${text(doc)}`);
  }

  // hybridSearch sends the query text only, so the server ranks by BM25.
  console.log("\n--- hybridSearch: 'Python web' ---");
  for (const doc of await store.hybridSearch("Python web", 3)) {
    console.log(`  [${Number(doc.metadata.score).toFixed(3)}] ${text(doc)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

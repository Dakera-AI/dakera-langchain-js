/**
 * Hybrid search (vector + BM25) with LangChain.js and Dakera.
 *
 * Usage:
 *   export DAKERA_API_URL="http://localhost:3300"
 *   npx tsx examples/hybrid_search.ts
 */

import { Document } from "@langchain/core/documents";
import { DakeraVectorStore } from "../src/vectorstore";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3300";
const apiKey = process.env.DAKERA_API_KEY ?? "";

const store = new DakeraVectorStore({
  apiUrl,
  apiKey,
  namespace: "examples-hybrid",
});

async function main() {
  const docs = [
    new Document({ pageContent: "Python is a high-level programming language.", metadata: { lang: "python" } }),
    new Document({ pageContent: "Rust provides memory safety without garbage collection.", metadata: { lang: "rust" } }),
    new Document({ pageContent: "TypeScript adds static types to JavaScript.", metadata: { lang: "typescript" } }),
    new Document({ pageContent: "Go is designed for concurrent systems programming.", metadata: { lang: "go" } }),
    new Document({ pageContent: "FastAPI is a modern Python web framework.", metadata: { lang: "python" } }),
  ];

  console.log("Indexing documents...");
  await store.addDocuments(docs);

  console.log("\n--- Similarity search: 'memory safe language' ---");
  const similar = await store.similaritySearch("memory safe language", 3);
  for (const doc of similar) {
    console.log(`  ${doc.pageContent.slice(0, 60)}`);
  }

  console.log("\n--- Hybrid search: 'Python web' (alpha=0.5) ---");
  const hybrid = await store.hybridSearch("Python web", 3, { alpha: 0.5 });
  for (const doc of hybrid) {
    console.log(`  [${doc.metadata.score?.toFixed(3)}] ${doc.pageContent.slice(0, 60)}`);
  }

  console.log("\n--- Full-text BM25: 'concurrent systems' ---");
  const fulltext = await store.fulltextSearch("concurrent systems", 3);
  for (const doc of fulltext) {
    console.log(`  [${doc.metadata.score?.toFixed(3)}] ${doc.pageContent.slice(0, 60)}`);
  }
}

main().catch(console.error);

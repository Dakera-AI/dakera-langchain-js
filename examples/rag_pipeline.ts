/**
 * RAG pipeline using DakeraVectorStore with LangChain.js.
 *
 * Indexes documents into Dakera's server-side vector store (no local
 * embeddings needed) and retrieves the most relevant chunks for a query.
 *
 * Usage:
 *   export DAKERA_API_URL="http://localhost:3300"
 *   export DAKERA_API_KEY="dk-..."          // optional
 *   npm install @dakera-ai/langchain @langchain/core
 *   npx tsx examples/rag_pipeline.ts
 */

import { Document } from "@langchain/core/documents";
import { DakeraVectorStore } from "@dakera-ai/langchain";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3300";
const apiKey = process.env.DAKERA_API_KEY ?? "";

const store = new DakeraVectorStore({
  apiUrl,
  namespace: "langchain-js-rag-demo",
  apiKey,
});

async function main() {
  const docs = [
    new Document({
      pageContent: "Dakera is an AI memory platform with server-side embedding.",
      metadata: { source: "overview" },
    }),
    new Document({
      pageContent: "LangChain.js is a TypeScript framework for building LLM applications.",
      metadata: { source: "overview" },
    }),
    new Document({
      pageContent: "Vector stores enable semantic search over document collections.",
      metadata: { source: "concepts" },
    }),
    new Document({
      pageContent: "RAG combines retrieval with generation for grounded answers.",
      metadata: { source: "concepts" },
    }),
  ];

  console.log("Indexing documents...");
  const ids = await store.addDocuments(docs);
  console.log(`Indexed ${ids.length} documents.`);

  console.log("\nSearching for: 'What is Dakera?'");
  const results = await store.similaritySearch("What is Dakera?", 2);
  results.forEach((doc, i) => {
    console.log(`  ${i + 1}. [${doc.metadata.source ?? ""}] ${doc.pageContent}`);
  });

  console.log("\nSearching with scores: 'semantic search'");
  const scored = await store.similaritySearchWithScore("semantic search", 2);
  scored.forEach(([doc, score]) => {
    console.log(`  [${score.toFixed(3)}] ${doc.pageContent}`);
  });
}

main().catch(console.error);

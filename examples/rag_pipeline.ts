/**
 * Retrieval with DakeraVectorStore.
 *
 * Indexes documents into a Dakera namespace (the server embeds them — no
 * embeddings API or local model) and retrieves the chunks most relevant to a
 * question, directly and through a LangChain retriever.
 *
 * Run from the repository root, with a Dakera server running:
 *   npm install && npm run build
 *   DAKERA_API_URL=http://localhost:3000 DAKERA_API_KEY=dk-mykey npx tsx examples/rag_pipeline.ts
 */

import { Document } from "@langchain/core/documents";
import { DakeraVectorStore } from "@dakera-ai/langchain";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3000";
const apiKey = process.env.DAKERA_API_KEY;

const store = new DakeraVectorStore({
  apiUrl,
  ...(apiKey ? { apiKey } : {}),
  namespace: "langchain-js-rag-demo",
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

  // Fixed ids make re-running the example overwrite the documents instead of
  // adding copies.
  console.log("Indexing documents...");
  const ids = await store.addDocuments(docs, { ids: ["overview-1", "overview-2", "concepts-1", "concepts-2"] });
  console.log(`Indexed ${ids.length} documents.`);

  console.log("\nSearching for: 'What is Dakera?'");
  const results = await store.similaritySearch("What is Dakera?", 2);
  results.forEach((doc, i) => {
    console.log(`  ${i + 1}. [${doc.metadata.source ?? ""}] ${doc.pageContent}`);
  });

  console.log("\nSearching with scores: 'semantic search'");
  const scored = await store.similaritySearchWithScore("semantic search", 2);
  for (const [doc, score] of scored) {
    console.log(`  [${score.toFixed(3)}] ${doc.pageContent}`);
  }

  // A retriever plugs the store into any LCEL chain: pass the retrieved
  // documents to a prompt as context.
  console.log("\nRetriever: 'grounded answers'");
  const retriever = store.asRetriever({ k: 1 });
  const [context] = await retriever.invoke("How do I get grounded answers?");
  console.log(`  ${context?.pageContent}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

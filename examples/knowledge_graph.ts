/**
 * Knowledge graph operations with LangChain.js and Dakera.
 *
 * Usage:
 *   export DAKERA_API_URL="http://localhost:3000"
 *   npx tsx examples/knowledge_graph.ts
 */

import { DakeraClient } from "@dakera-ai/dakera";
import { DakeraKnowledgeGraph } from "../src/knowledge-graph";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3000";
const apiKey = process.env.DAKERA_API_KEY ?? "";

const kg = new DakeraKnowledgeGraph({
  apiUrl,
  apiKey,
  agentId: "langchain-js-kg-demo",
});

async function main() {
  // Seed the agent with two related memories to build and summarize from.
  const client = new DakeraClient({ baseUrl: apiUrl, ...(apiKey ? { apiKey } : {}) });
  const first = await client.storeMemory("langchain-js-kg-demo", {
    content: "Alice leads the payments team in Berlin.",
    importance: 0.8,
  });
  const second = await client.storeMemory("langchain-js-kg-demo", {
    content: "The payments team in Berlin ships the new checkout in March.",
    importance: 0.8,
  });

  console.log("--- Graph export ---");
  const graph = await kg.export();
  console.log(`Nodes: ${graph.nodeCount}, Edges: ${graph.edgeCount}`);

  console.log("\n--- Graph query ---");
  const results = await kg.query({ maxDepth: 3, limit: 10 });
  console.log(`Found ${results.edgeCount} edges`);
  for (const edge of results.edges.slice(0, 5)) {
    console.log(`  ${JSON.stringify(edge)}`);
  }

  console.log("\n--- Build graph around a memory ---");
  const tree = (await kg.build(first.memory.id, { depth: 2 })) as { total_nodes?: number };
  console.log(`Graph around ${first.memory.id}: ${tree.total_nodes} nodes`);

  console.log("\n--- Summarize ---");
  const summary = await kg.summarize([first.memory.id, second.memory.id]);
  console.log(`Summary of ${summary.source_count} memories: ${summary.summary_memory.content}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

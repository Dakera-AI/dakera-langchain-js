/**
 * The agent's memory knowledge graph with DakeraKnowledgeGraph.
 *
 * Stores two related memories, links them, builds the graph around one of
 * them and summarizes both into a new memory.
 *
 * Run from the repository root, with a Dakera server running:
 *   npm install && npm run build
 *   DAKERA_API_URL=http://localhost:3000 DAKERA_API_KEY=dk-mykey npx tsx examples/knowledge_graph.ts
 */

import { DakeraClient } from "@dakera-ai/dakera";
import { DakeraKnowledgeGraph } from "@dakera-ai/langchain";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3000";
const apiKey = process.env.DAKERA_API_KEY;
const agentId = "langchain-js-kg-demo";

const kg = new DakeraKnowledgeGraph({ apiUrl, ...(apiKey ? { apiKey } : {}), agentId });

async function main() {
  // Seed the agent with two related memories (the low-level SDK client stores them).
  const client = new DakeraClient({ baseUrl: apiUrl, ...(apiKey ? { apiKey } : {}) });
  const first = await client.storeMemory(agentId, {
    content: "Alice leads the payments team in Berlin.",
    importance: 0.8,
  });
  const second = await client.storeMemory(agentId, {
    content: "The payments team in Berlin ships the new checkout in March.",
    importance: 0.8,
  });

  console.log("--- Link the two memories ---");
  await kg.link(first.memory.id, second.memory.id, "same team");
  console.log(`Linked ${first.memory.id} -> ${second.memory.id}`);

  console.log("\n--- Graph export ---");
  const graph = await kg.export();
  console.log(`Nodes: ${graph.nodeCount}, Edges: ${graph.edgeCount}`);

  console.log("\n--- Graph query ---");
  const results = await kg.query({ maxDepth: 3, limit: 10 });
  console.log(`Found ${results.edgeCount} edges`);
  for (const edge of results.edges.slice(0, 5)) {
    console.log(`  ${JSON.stringify(edge)}`);
  }

  console.log("\n--- Build the graph around a memory ---");
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

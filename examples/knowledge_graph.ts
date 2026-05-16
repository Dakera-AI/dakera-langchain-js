/**
 * Knowledge graph operations with LangChain.js and Dakera.
 *
 * Usage:
 *   export DAKERA_API_URL="http://localhost:3300"
 *   npx tsx examples/knowledge_graph.ts
 */

import { DakeraKnowledgeGraph } from "../src/knowledge-graph";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3300";
const apiKey = process.env.DAKERA_API_KEY ?? "";

const kg = new DakeraKnowledgeGraph({
  apiUrl,
  apiKey,
  agentId: "langchain-js-kg-demo",
});

async function main() {
  console.log("--- Graph export ---");
  const graph = await kg.export();
  console.log(`Nodes: ${graph.nodeCount}, Edges: ${graph.edgeCount}`);

  console.log("\n--- Graph query ---");
  const results = await kg.query({ maxDepth: 3, limit: 10 });
  console.log(`Found ${results.edgeCount} edges`);
  for (const edge of results.edges.slice(0, 5)) {
    console.log(`  ${JSON.stringify(edge)}`);
  }

  console.log("\n--- Build full graph ---");
  const full = await kg.build();
  console.log(`Full graph: ${JSON.stringify(full)}`);
}

main().catch(console.error);

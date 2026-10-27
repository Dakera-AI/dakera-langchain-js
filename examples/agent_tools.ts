/**
 * Agent statistics, listing and import / export with DakeraAgentTools.
 *
 * Imports memories from JSON lines (only `content` is required), lists them,
 * reads the agent's statistics and exports everything back.
 *
 * Run from the repository root, with a Dakera server running:
 *   npm install && npm run build
 *   DAKERA_API_URL=http://localhost:3000 DAKERA_API_KEY=dk-mykey npx tsx examples/agent_tools.ts
 */

import { DakeraAgentTools } from "@dakera-ai/langchain";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3000";
const apiKey = process.env.DAKERA_API_KEY;

const agent = new DakeraAgentTools({
  apiUrl,
  ...(apiKey ? { apiKey } : {}),
  // A fresh agent per run, so the listing below shows just this run's import.
  agentId: `langchain-js-agent-demo-${Date.now()}`,
});

async function main() {
  console.log("--- Import ---");
  const job = await agent.importMemories([
    { content: "The customer prefers email over phone calls.", importance: 0.8, tags: ["preference"] },
    { content: "The customer's contract renews in January." },
  ]);
  console.log(`Job ${job.job_id}: ${job.status}, imported ${job.imported} of ${job.total}`);

  console.log("\n--- Memories (newest first) ---");
  for (const m of await agent.memories({ limit: 10 })) {
    console.log(`  [${m.memoryType}, ${m.importance}] ${m.content} ${m.tags.length ? `#${m.tags.join(" #")}` : ""}`);
  }

  console.log("\n--- Stats ---");
  console.log(JSON.stringify(await agent.stats(), null, 2));

  console.log("\n--- Export ---");
  const exported = await agent.exportMemories();
  console.log(`Exported ${exported.length} memories (JSON lines, re-importable with importMemories()).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

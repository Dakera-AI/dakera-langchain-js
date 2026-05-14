/**
 * Basic conversational memory with LangChain.js and Dakera.
 *
 * Stores each conversation turn in Dakera and recalls relevant context
 * on the next turn using semantic search.
 *
 * Usage:
 *   export DAKERA_API_URL="http://localhost:3300"
 *   export DAKERA_API_KEY="dk-..."          // optional
 *   npm install @dakera-ai/langchain @langchain/core
 *   npx tsx examples/basic_memory.ts
 */

import { DakeraMemory } from "@dakera-ai/langchain";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3300";
const apiKey = process.env.DAKERA_API_KEY ?? "";

const memory = new DakeraMemory({
  apiUrl,
  apiKey,
  agentId: "langchain-js-demo",
  recallK: 3,
  importance: 0.8,
});

async function main() {
  await memory.saveContext(
    { input: "My favorite color is blue." },
    { output: "Got it! I'll remember that your favorite color is blue." },
  );
  await memory.saveContext(
    { input: "I work as a software engineer at Acme Corp." },
    { output: "Nice! Software engineering at Acme Corp — noted." },
  );

  const result = await memory.loadMemoryVariables({
    input: "What do you know about me?",
  });
  console.log("Recalled memories:");
  console.log(result.history);
}

main().catch(console.error);

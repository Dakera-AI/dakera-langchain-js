/**
 * Conversational memory with DakeraMemory.
 *
 * Stores each conversation turn in Dakera and recalls the turns most relevant
 * to the next input. The memories live on the server, so a later process with
 * the same `agentId` recalls them too.
 *
 * Run from the repository root, with a Dakera server running:
 *   npm install && npm run build
 *   DAKERA_API_URL=http://localhost:3000 DAKERA_API_KEY=dk-mykey npx tsx examples/basic_memory.ts
 */

import { DakeraMemory } from "@dakera-ai/langchain";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3000";
const apiKey = process.env.DAKERA_API_KEY;

const memory = new DakeraMemory({
  apiUrl,
  ...(apiKey ? { apiKey } : {}),
  // One agent per user or assistant; a fresh one per run keeps the output short.
  agentId: `langchain-js-demo-${Date.now()}`,
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

  // `history` holds at most `recallK` memories, most relevant first.
  const { history } = await memory.loadMemoryVariables({
    input: "Where do I work?",
  });
  console.log("Recalled memories:");
  console.log(history);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

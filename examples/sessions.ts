/**
 * Session-scoped memory with LangChain.js and Dakera.
 *
 * Usage:
 *   export DAKERA_API_URL="http://localhost:3300"
 *   npx tsx examples/sessions.ts
 */

import { DakeraSessionManager } from "../src/sessions";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3300";
const apiKey = process.env.DAKERA_API_KEY ?? "";

const sessions = new DakeraSessionManager({
  apiUrl,
  apiKey,
  agentId: "langchain-js-session-demo",
});

async function main() {
  const sessionId = await sessions.start({ topic: "onboarding", user: "alice" });
  console.log(`Started session: ${sessionId}`);

  // Memories stored during this session are grouped together
  const info = await sessions.get(sessionId);
  console.log(`Session agent: ${info.agentId}`);

  await sessions.end("Completed onboarding walkthrough");
  console.log("Session ended.");

  const all = await sessions.list();
  console.log(`Total sessions: ${all.length}`);
}

main().catch(console.error);

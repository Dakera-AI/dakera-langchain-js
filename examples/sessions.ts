/**
 * Conversation sessions with DakeraSessionManager.
 *
 * Starts a session, stores the conversation's turns in it through
 * DakeraMemory, keeps it open with touch() and ends it with a summary. The
 * server ends a session after 4 h without activity by default; `start()` takes
 * a per-session `idleTimeoutSecs`.
 *
 * Run from the repository root, with a Dakera server (v0.12.2 or later) running:
 *   npm install && npm run build
 *   DAKERA_API_URL=http://localhost:3000 DAKERA_API_KEY=dk-mykey npx tsx examples/sessions.ts
 */

import { DakeraMemory, DakeraSessionManager } from "@dakera-ai/langchain";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3000";
const apiKey = process.env.DAKERA_API_KEY;
const conn = { apiUrl, ...(apiKey ? { apiKey } : {}) };
const agentId = "langchain-js-session-demo";

const sessions = new DakeraSessionManager({ ...conn, agentId });

async function main() {
  const sessionId = await sessions.start(
    { topic: "onboarding", user: "alice" },
    { idleTimeoutSecs: 30 * 60 },
  );
  console.log(`Started session: ${sessionId}`);

  // Turns stored by this memory belong to the session.
  const memory = new DakeraMemory({ ...conn, agentId, sessionId });
  await memory.saveContext({ input: "I'm setting up my account." }, { output: "Let's start with your profile." });
  await memory.saveContext({ input: "My team is Payments." }, { output: "Added you to Payments." });

  const stored = await sessions.memories(sessionId);
  console.log(`Memories in the session: ${stored.length}`);
  for (const m of stored) {
    console.log(`  ${m.content.replace("\n", " | ")}`);
  }

  // Record activity so the idle timeout does not end the session.
  console.log(`Still active: ${await sessions.touch()}`);

  await sessions.end("Completed onboarding walkthrough");
  const ended = await sessions.get(sessionId);
  console.log(`Session ended (${ended.endedReason}): ${ended.summary}`);

  const all = await sessions.list();
  console.log(`Sessions of ${agentId}: ${all.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

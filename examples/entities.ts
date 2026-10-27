/**
 * Named-entity extraction with DakeraEntityExtractor.
 *
 * Extracts entities from a text with the server's built-in rule-based
 * extractor (dates, emails, URLs, ...), then turns on extraction of people,
 * organisations and places for the agent's memories (the server's neural
 * extractor).
 *
 * Run from the repository root, with a Dakera server (v0.12.2 or later) running:
 *   npm install && npm run build
 *   DAKERA_API_URL=http://localhost:3000 DAKERA_API_KEY=dk-mykey npx tsx examples/entities.ts
 */

import { DakeraEntityExtractor } from "@dakera-ai/langchain";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3000";
const apiKey = process.env.DAKERA_API_KEY;

const extractor = new DakeraEntityExtractor({
  apiUrl,
  ...(apiKey ? { apiKey } : {}),
  agentId: "langchain-js-entity-demo",
});

async function main() {
  console.log("--- Extracting entities ---");
  const entities = await extractor.extract(
    "Email alice@example.com about the launch on March 1, 2026 (details: https://dakera.ai).",
  );
  for (const entity of entities) {
    console.log(`  [${entity.type}] ${entity.value} (confidence: ${entity.confidence.toFixed(2)})`);
  }

  console.log("\n--- Turn on extraction for the agent's memories ---");
  await extractor.configure(["person", "organization", "location"]);
  console.log("Configured: person, organization, location");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

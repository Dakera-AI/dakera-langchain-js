/**
 * Entity extraction with LangChain.js and Dakera.
 *
 * Usage:
 *   export DAKERA_API_URL="http://localhost:3300"
 *   npx tsx examples/entities.ts
 */

import { DakeraEntityExtractor } from "../src/entities";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3300";
const apiKey = process.env.DAKERA_API_KEY ?? "";

const extractor = new DakeraEntityExtractor({
  apiUrl,
  apiKey,
  agentId: "langchain-js-entity-demo",
});

async function main() {
  console.log("--- Extracting entities ---");
  const entities = await extractor.extract(
    "Apple released iOS 18 in Cupertino, California on September 16, 2024.",
  );

  for (const entity of entities) {
    console.log(`  [${entity.type}] ${entity.value} (confidence: ${entity.confidence.toFixed(2)})`);
  }

  console.log("\n--- Configure entity types ---");
  await extractor.configure(["PERSON", "ORG", "LOCATION"]);
  console.log("Configured: PERSON, ORG, LOCATION");
}

main().catch(console.error);

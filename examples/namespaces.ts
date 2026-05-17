/**
 * Namespace management with LangChain.js and Dakera.
 *
 * Usage:
 *   export DAKERA_API_URL="http://localhost:3300"
 *   npx tsx examples/namespaces.ts
 */

import { DakeraNamespaceManager } from "../src/namespaces";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3300";
const apiKey = process.env.DAKERA_API_KEY ?? "";

const ns = new DakeraNamespaceManager({ apiUrl, apiKey });

async function main() {
  console.log("--- List namespaces ---");
  const all = await ns.list();
  for (const n of all) {
    console.log(`  ${n.name} (dim=${n.dimension}, vectors=${n.vectorCount})`);
  }

  console.log("\n--- Create namespace ---");
  await ns.create("example-ns", { dimensions: 384 });
  console.log("Created: example-ns");

  console.log("\n--- Get namespace info ---");
  const info = await ns.get("example-ns");
  console.log(`  Name: ${info.name}`);
  console.log(`  Dimension: ${info.dimension}`);
  console.log(`  Vectors: ${info.vectorCount}`);

  console.log("\n--- Cleanup ---");
  await ns.delete("example-ns");
  console.log("Deleted: example-ns");
}

main().catch(console.error);

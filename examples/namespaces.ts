/**
 * Vector namespaces with DakeraNamespaceManager.
 *
 * Lists the namespaces, creates one, reads it back and deletes it.
 *
 * Run from the repository root, with a Dakera server running:
 *   npm install && npm run build
 *   DAKERA_API_URL=http://localhost:3000 DAKERA_API_KEY=dk-mykey npx tsx examples/namespaces.ts
 */

import { DakeraNamespaceManager } from "@dakera-ai/langchain";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3000";
const apiKey = process.env.DAKERA_API_KEY;

const ns = new DakeraNamespaceManager({ apiUrl, ...(apiKey ? { apiKey } : {}) });

async function main() {
  // Agent memory and server namespaces are listed too; keep the vector ones.
  console.log("--- List vector namespaces ---");
  for (const n of (await ns.list()).filter((n) => n.kind === "data")) {
    console.log(`  ${n.name}`);
  }

  console.log("\n--- Create namespace ---");
  await ns.create("example-ns", { dimensions: 384, distance: "cosine" });
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

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

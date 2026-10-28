/**
 * Live tests against a real Dakera server. Skipped unless DAKERA_API_URL is set:
 *
 *   docker run -d -p 3300:3300 -e DAKERA_PORT=3300 -e DAKERA_AUTH_ENABLED=false ghcr.io/dakera-ai/dakera:0.12.3
 *   DAKERA_API_URL=http://localhost:3300 npm test
 */
import { describe, it, expect } from "vitest";
import { Document } from "@langchain/core/documents";
import { DakeraClient } from "@dakera-ai/dakera";
import {
  DakeraAgentTools,
  DakeraEntityExtractor,
  DakeraKnowledgeGraph,
  DakeraMemory,
  DakeraNamespaceManager,
  DakeraSessionManager,
  DakeraVectorStore,
} from "../src/index.js";

const apiUrl = process.env["DAKERA_API_URL"] ?? "";
const apiKey = process.env["DAKERA_API_KEY"];
const conn = { apiUrl, ...(apiKey !== undefined ? { apiKey } : {}) };

function unique(name: string): string {
  return `lcjs-it-${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

describe.skipIf(!apiUrl)("live Dakera server", () => {
  const client = new DakeraClient({ baseUrl: apiUrl, ...(apiKey !== undefined ? { apiKey } : {}) });

  it("DakeraMemory stores turns and recalls at most recallK of them", async () => {
    const agentId = unique("memory");
    const memory = new DakeraMemory({ ...conn, agentId, recallK: 2 });
    await memory.saveContext({ input: "My project is called NeuralBridge." }, { output: "Noted." });
    await memory.saveContext({ input: "NeuralBridge is written in Rust." }, { output: "Got it." });
    await memory.saveContext({ input: "NeuralBridge ships in March." }, { output: "Okay." });

    const { history } = await memory.loadMemoryVariables({ input: "What is NeuralBridge?" });
    const lines = String(history).split("\n").filter((l) => l.startsWith("Human:"));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(String(history)).toContain("NeuralBridge");
  });

  it("DakeraMemory recalls nothing for an agent that has stored nothing", async () => {
    const memory = new DakeraMemory({ ...conn, agentId: unique("empty") });
    expect(await memory.loadMemoryVariables({ input: "anything" })).toEqual({ history: "" });
  });

  it("DakeraMemory stores turns in its session", async () => {
    const agentId = unique("session-memory");
    const sessions = new DakeraSessionManager({ ...conn, agentId });
    const sessionId = await sessions.start({ channel: "test" });
    const memory = new DakeraMemory({ ...conn, agentId, sessionId });
    await memory.saveContext({ input: "I prefer metric units." }, { output: "Noted." });

    const stored = await sessions.memories(sessionId);
    expect(stored.some((m) => m.content.includes("metric units"))).toBe(true);
    await sessions.end("Preferences captured");
  });

  it("DakeraSessionManager start / touch / end / get / list", async () => {
    const sessions = new DakeraSessionManager({ ...conn, agentId: unique("sessions") });
    const sessionId = await sessions.start({ topic: "onboarding" }, { idleTimeoutSecs: 600 });
    expect(sessions.currentSessionId).toBe(sessionId);
    expect(await sessions.touch()).toBe(true);

    await sessions.end("Completed onboarding");
    expect(sessions.currentSessionId).toBeNull();
    const ended = await sessions.get(sessionId);
    expect(ended.summary).toBe("Completed onboarding");
    expect(ended.endedReason).toBe("client");
    expect(ended.metadata).toMatchObject({ topic: "onboarding" });
    expect((await sessions.list()).map((s) => s.id)).toContain(sessionId);
  });

  it("DakeraVectorStore indexes and searches documents", async () => {
    const store = new DakeraVectorStore({ ...conn, namespace: unique("vs") });
    const ids = await store.addDocuments([
      new Document({ pageContent: "Rust provides memory safety without garbage collection.", metadata: { lang: "rust" } }),
      new Document({ pageContent: "FastAPI is a modern Python web framework.", metadata: { lang: "python" } }),
    ]);
    expect(ids).toHaveLength(2);

    const [top] = await store.similaritySearchWithScore("memory safe systems language", 1);
    expect(top?.[0].pageContent).toContain("Rust");
    expect(top?.[0].metadata["lang"]).toBe("rust");

    const fulltext = await store.fulltextSearch("python web", 2);
    expect(fulltext[0]?.metadata["id"]).toBe(ids[1]);
    const retriever = store.asRetriever({ k: 1 });
    expect((await retriever.invoke("Python framework"))[0]?.pageContent).toContain("FastAPI");
  });

  it("DakeraVectorStore uses embeddingModel for writes and searches", async () => {
    const store = new DakeraVectorStore({ ...conn, namespace: unique("vs-model"), embeddingModel: "bge-large" });
    await store.addDocuments([new Document({ pageContent: "The capital of France is Paris.", metadata: {} })]);
    const [doc] = await store.similaritySearch("French capital", 1);
    expect(doc?.pageContent).toContain("Paris");
  });

  it("DakeraKnowledgeGraph build / summarize / link", async () => {
    const agentId = unique("kg");
    const kg = new DakeraKnowledgeGraph({ ...conn, agentId });
    const first = await client.storeMemory(agentId, { content: "Alice leads the payments team in Berlin." });
    const second = await client.storeMemory(agentId, { content: "The Berlin payments team ships checkout in March." });

    await kg.link(first.memory.id, second.memory.id, "same team");
    const tree = (await kg.build(first.memory.id, { depth: 2 })) as { total_nodes?: number };
    expect(tree.total_nodes).toBeGreaterThanOrEqual(1);
    const summary = await kg.summarize([first.memory.id, second.memory.id]);
    expect(summary.source_count).toBe(2);
    expect(summary.summary_memory.content.length).toBeGreaterThan(0);
  });

  it("DakeraEntityExtractor extracts and configures an agent that has stored nothing", async () => {
    const extractor = new DakeraEntityExtractor({ ...conn, agentId: unique("entities") });
    const entities = await extractor.extract("Apple opened an office in Berlin.");
    expect(Array.isArray(entities)).toBe(true);
    await expect(extractor.configure(["ORG", "LOCATION"])).resolves.toBeUndefined();
  });

  it("DakeraAgentTools import / export / memories", async () => {
    const agentId = unique("agent-tools");
    const tools = new DakeraAgentTools({ ...conn, agentId });
    const job = await tools.importMemories([
      { content: "Imported fact one.", importance: 0.6, tags: ["import"] },
      { content: "Imported fact two." },
    ]);
    expect(job.imported).toBe(2);

    const listed = await tools.memories({ limit: 10 });
    expect(listed.map((m) => m.content).sort()).toEqual(["Imported fact one.", "Imported fact two."]);
    expect(listed.find((m) => m.content === "Imported fact one.")?.tags).toEqual(["import"]);
    const exported = await tools.exportMemories();
    expect(exported).toHaveLength(2);
  });

  it("DakeraNamespaceManager create / get / delete", async () => {
    const ns = new DakeraNamespaceManager(conn);
    const name = unique("ns");
    await ns.create(name, { dimensions: 384, distance: "cosine" });
    const info = await ns.get(name);
    expect(info.name).toBe(name);
    expect(info.dimension).toBe(384);
    expect((await ns.list()).map((n) => n.name)).toContain(name);
    await ns.delete(name);
  });
});

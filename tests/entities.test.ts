import { describe, it, expect, vi, beforeEach } from "vitest";
import { DakeraEntityExtractor } from "../src/entities.js";

vi.mock("@dakera-ai/dakera", () => ({
  NotFoundError: class NotFoundError extends Error {},
  DakeraClient: vi.fn().mockImplementation(function () {
    return {
      extractEntities: vi.fn().mockResolvedValue({
        entities: [
          { entity_type: "PERSON", value: "Alice", score: 0.95 },
          { entity_type: "ORG", value: "Dakera", score: 0.88 },
        ],
      }),
      memoryEntities: vi.fn().mockResolvedValue({
        entities: [{ entity_type: "LOC", value: "Berlin", score: 0.92 }],
      }),
      configureNamespaceNer: vi.fn().mockResolvedValue(undefined),
      createAgent: vi.fn().mockResolvedValue({ agent_id: "test-agent", created: true }),
    };
  }),
}));

describe("DakeraEntityExtractor", () => {
  let extractor: DakeraEntityExtractor;

  beforeEach(() => {
    extractor = new DakeraEntityExtractor({
      apiUrl: "http://localhost:3000",
      apiKey: "dk-test",
      agentId: "test-agent",
    });
  });

  it("extracts entities from text", async () => {
    const entities = await extractor.extract("Alice works at Dakera");
    expect(entities).toHaveLength(2);
    expect(entities[0]).toEqual({ type: "PERSON", value: "Alice", confidence: 0.95 });
    expect(entities[1]).toEqual({ type: "ORG", value: "Dakera", confidence: 0.88 });
  });

  it("handles null entities gracefully", async () => {
    const entities = await extractor.extract("text with entities");
    expect(Array.isArray(entities)).toBe(true);
  });

  it("gets memory entities", async () => {
    const entities = await extractor.memoryEntities("mem_123");
    expect(entities).toHaveLength(1);
    expect(entities[0]).toEqual({ type: "LOC", value: "Berlin", confidence: 0.92 });
  });

  it("configures entity types", async () => {
    await expect(extractor.configure(["PERSON", "ORG"])).resolves.toBeUndefined();
  });

  it("configures without explicit types", async () => {
    await expect(extractor.configure()).resolves.toBeUndefined();
  });

  const clientOf = (e: DakeraEntityExtractor) =>
    (e as unknown as { client: Record<string, ReturnType<typeof vi.fn>> }).client;

  it("configures the agent's memory namespace", async () => {
    await extractor.configure(["PERSON"]);
    expect(clientOf(extractor).configureNamespaceNer).toHaveBeenCalledWith(
      "_dakera_agent_test-agent",
      { extract_entities: true, entity_types: ["PERSON"] },
    );
    expect(clientOf(extractor).createAgent).not.toHaveBeenCalled();
  });

  it("creates an agent that has no namespace yet, then configures it", async () => {
    const { NotFoundError } = await import("@dakera-ai/dakera");
    const client = clientOf(extractor);
    client.configureNamespaceNer.mockRejectedValueOnce(new NotFoundError("Namespace not found"));
    await extractor.configure();
    expect(client.createAgent).toHaveBeenCalledWith("test-agent");
    expect(client.configureNamespaceNer).toHaveBeenCalledTimes(2);
  });

  it("does not create the agent on other errors", async () => {
    const client = clientOf(extractor);
    client.configureNamespaceNer.mockRejectedValueOnce(new Error("forbidden"));
    await expect(extractor.configure()).rejects.toThrow("forbidden");
    expect(client.createAgent).not.toHaveBeenCalled();
  });
});

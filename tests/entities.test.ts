import { describe, it, expect, vi, beforeEach } from "vitest";
import { DakeraEntityExtractor } from "../src/entities.js";

vi.mock("@dakera-ai/dakera", () => ({
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
});

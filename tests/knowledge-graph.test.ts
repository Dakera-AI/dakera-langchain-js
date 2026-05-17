import { describe, it, expect, vi, beforeEach } from "vitest";
import { DakeraKnowledgeGraph } from "../src/knowledge-graph.js";

vi.mock("@dakera-ai/dakera", () => ({
  DakeraClient: vi.fn().mockImplementation(function () {
    return {
      knowledgeQuery: vi.fn().mockResolvedValue({
        edges: [{ source_id: "a", target_id: "b", edge_type: "related_to" }],
        node_count: 2,
        edge_count: 1,
      }),
      knowledgePath: vi.fn().mockResolvedValue({ path: ["a", "c", "b"], hop_count: 2 }),
      memoryLink: vi.fn().mockResolvedValue(undefined),
      knowledgeExport: vi.fn().mockResolvedValue({
        edges: [{ source_id: "x", target_id: "y", edge_type: "linked_by" }],
        node_count: 5,
        edge_count: 3,
      }),
      knowledgeGraph: vi.fn().mockResolvedValue({ status: "ok" }),
      summarize: vi.fn().mockResolvedValue({ summary: "3 clusters" }),
      deduplicate: vi.fn().mockResolvedValue({ merged: 2 }),
    };
  }),
  agentId: vi.fn((id: string) => id),
}));

describe("DakeraKnowledgeGraph", () => {
  let kg: DakeraKnowledgeGraph;

  beforeEach(() => {
    kg = new DakeraKnowledgeGraph({
      apiUrl: "http://localhost:3000",
      apiKey: "dk-test",
      agentId: "test-agent",
    });
  });

  it("queries the knowledge graph", async () => {
    const result = await kg.query({ rootId: "a", maxDepth: 2 });
    expect(result.edges).toHaveLength(1);
    expect(result.nodeCount).toBe(2);
    expect(result.edgeCount).toBe(1);
  });

  it("queries with default options", async () => {
    const result = await kg.query();
    expect(result.nodeCount).toBe(2);
  });

  it("finds path between nodes", async () => {
    const result = await kg.path("a", "b");
    expect(result).toEqual({ path: ["a", "c", "b"], hop_count: 2 });
  });

  it("links two memories", async () => {
    await expect(kg.link("mem_1", "ent_1", "causes")).resolves.toBeUndefined();
  });

  it("links with default relation", async () => {
    await expect(kg.link("mem_1", "ent_1")).resolves.toBeUndefined();
  });

  it("exports the knowledge graph", async () => {
    const result = await kg.export();
    expect(result.nodeCount).toBe(5);
    expect(result.edgeCount).toBe(3);
    expect(result.edges).toHaveLength(1);
  });

  it("builds the knowledge graph", async () => {
    const result = await kg.build();
    expect(result).toEqual({ status: "ok" });
  });

  it("summarizes the knowledge graph", async () => {
    const result = await kg.summarize();
    expect(result).toEqual({ summary: "3 clusters" });
  });

  it("deduplicates entities", async () => {
    const result = await kg.deduplicate();
    expect(result).toEqual({ merged: 2 });
  });
});

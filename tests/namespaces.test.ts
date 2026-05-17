import { describe, it, expect, vi, beforeEach } from "vitest";
import { DakeraNamespaceManager } from "../src/namespaces.js";

vi.mock("@dakera-ai/dakera", () => ({
  DakeraClient: vi.fn().mockImplementation(function () {
    return {
      createNamespace: vi.fn().mockResolvedValue({ namespace: "test-ns", dimension: 384, vector_count: 0 }),
      getNamespace: vi.fn().mockResolvedValue({ namespace: "my-ns", dimension: 768, vector_count: 1500 }),
      listNamespaces: vi.fn().mockResolvedValue([
        { namespace: "ns-a", dimension: 384, vector_count: 100 },
        { namespace: "ns-b", dimension: 768, vector_count: 200 },
      ]),
      configureNamespace: vi.fn().mockResolvedValue(undefined),
      deleteNamespace: vi.fn().mockResolvedValue(undefined),
      getIndexStats: vi.fn().mockResolvedValue({ total_vectors: 5000, dimensions: 384, index_type: "hnsw" }),
    };
  }),
}));

describe("DakeraNamespaceManager", () => {
  let ns: DakeraNamespaceManager;

  beforeEach(() => {
    ns = new DakeraNamespaceManager({
      apiUrl: "http://localhost:3000",
      apiKey: "dk-test",
    });
  });

  it("creates a namespace", async () => {
    const result = await ns.create("test-ns", { dimensions: 384, indexType: "hnsw" });
    expect(result).toBeDefined();
  });

  it("creates a namespace with metadata", async () => {
    await expect(
      ns.create("ns2", { metadata: { env: "prod" } }),
    ).resolves.toBeDefined();
  });

  it("gets namespace info", async () => {
    const info = await ns.get("my-ns");
    expect(info.name).toBe("my-ns");
    expect(info.dimension).toBe(768);
    expect(info.vectorCount).toBe(1500);
  });

  it("lists namespaces", async () => {
    const list = await ns.list();
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe("ns-a");
    expect(list[0].dimension).toBe(384);
    expect(list[0].vectorCount).toBe(100);
  });

  it("configures a namespace", async () => {
    await expect(
      ns.configure("my-ns", { dimension: 768, distance: "cosine" }),
    ).resolves.toBeUndefined();
  });

  it("deletes a namespace", async () => {
    await expect(ns.delete("old-ns")).resolves.toBeUndefined();
  });

  it("gets namespace stats", async () => {
    const stats = await ns.stats("my-ns");
    expect(stats).toBeDefined();
  });
});

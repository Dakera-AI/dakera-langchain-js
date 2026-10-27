import { describe, it, expect, vi, beforeEach } from "vitest";
import { DakeraNamespaceManager } from "../src/namespaces.js";

vi.mock("@dakera-ai/dakera", () => ({
  DakeraClient: vi.fn().mockImplementation(function () {
    return {
      createNamespace: vi.fn().mockResolvedValue({ namespace: "test-ns", dimension: 384, vector_count: 0 }),
      getNamespace: vi
        .fn()
        .mockResolvedValue({ namespace: "my-ns", dimension: 768, vector_count: 1500, kind: "data" }),
      // The SDK builds the listing from the server's names (and kinds) only;
      // vector_count is a placeholder 0.
      listNamespaces: vi.fn().mockResolvedValue([
        { namespace: "ns-a", vector_count: 0, kind: "data" },
        { namespace: "_dakera_agent_bot", vector_count: 0, kind: "agent" },
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

  const clientOf = (m: DakeraNamespaceManager) =>
    (m as unknown as { client: Record<string, ReturnType<typeof vi.fn>> }).client;

  it("passes only dimensions, distance and indexType to the SDK", async () => {
    await ns.create("ns3", {
      dimensions: 384,
      distance: "dot_product",
      indexType: "hnsw",
      metadata: { env: "prod" },
    });
    expect(clientOf(ns).createNamespace).toHaveBeenCalledWith("ns3", {
      dimensions: 384,
      distance: "dot_product",
      indexType: "hnsw",
    });
  });

  it("gets namespace info", async () => {
    const info = await ns.get("my-ns");
    expect(info.name).toBe("my-ns");
    expect(info.dimension).toBe(768);
    expect(info.vectorCount).toBe(1500);
    expect(info.kind).toBe("data");
  });

  it("lists namespaces", async () => {
    const list = await ns.list();
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({ name: "ns-a", dimension: undefined, vectorCount: undefined, kind: "data" });
    expect(list[1].kind).toBe("agent");
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

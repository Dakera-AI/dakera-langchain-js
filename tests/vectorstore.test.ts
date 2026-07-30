import { describe, it, expect, vi, beforeEach } from "vitest";
import { Document } from "@langchain/core/documents";
import { DakeraVectorStore } from "../src/vectorstore.js";

// Mock @dakera-ai/dakera
vi.mock("@dakera-ai/dakera", () => ({
  DakeraClient: vi.fn().mockImplementation(function () {
    return {
      upsertText: vi.fn().mockResolvedValue({ upserted: 2 }),
      queryText: vi.fn().mockResolvedValue({
        results: [
          { id: "doc1", text: "Hello world", score: 0.95, metadata: { source: "test" } },
          { id: "doc2", text: "Foo bar", score: 0.80, metadata: {} },
        ],
      }),
      hybridSearch: vi.fn().mockResolvedValue([
        { id: "h1", score: 0.92, metadata: { source: "hybrid" } },
        { id: "h2", score: 0.75, metadata: {} },
      ]),
      fulltextSearch: vi.fn().mockResolvedValue([
        { id: "f1", score: 0.88, metadata: { source: "fts" } },
      ]),
    };
  }),
}));

const storeOptions = {
  apiUrl: "http://localhost:3000",
  apiKey: "dk-test",
  namespace: "test-ns",
};

describe("DakeraVectorStore", () => {
  let store: DakeraVectorStore;

  beforeEach(() => {
    store = new DakeraVectorStore(storeOptions);
  });

  it("reports vectorstore type", () => {
    expect(store._vectorstoreType()).toBe("dakera");
  });

  it("addDocuments upserts and returns IDs", async () => {
    const docs = [
      new Document({ pageContent: "Hello world", metadata: {} }),
      new Document({ pageContent: "Foo bar", metadata: {} }),
    ];
    const ids = await store.addDocuments(docs);
    expect(ids).toHaveLength(2);
    ids.forEach((id) => expect(typeof id).toBe("string"));
  });

  it("addDocuments uses provided IDs", async () => {
    const docs = [new Document({ pageContent: "Test", metadata: {} })];
    const ids = await store.addDocuments(docs, { ids: ["my-id-1"] });
    expect(ids).toEqual(["my-id-1"]);
  });

  it("similaritySearch returns Documents", async () => {
    const results = await store.similaritySearch("hello", 2);
    expect(results).toHaveLength(2);
    expect(results[0]).toBeInstanceOf(Document);
    expect(results[0]!.pageContent).toBe("Hello world");
  });

  it("similaritySearchWithScore returns [Document, number] pairs", async () => {
    const results = await store.similaritySearchWithScore("hello", 2);
    expect(results).toHaveLength(2);
    const [doc, score] = results[0]!;
    expect(doc).toBeInstanceOf(Document);
    expect(typeof score).toBe("number");
    expect(score).toBeCloseTo(0.95);
  });

  it("fromDocuments creates store and adds docs", async () => {
    const docs = [new Document({ pageContent: "Test doc", metadata: {} })];
    const newStore = await DakeraVectorStore.fromDocuments(
      docs,
      {} as never,
      storeOptions,
    );
    expect(newStore).toBeInstanceOf(DakeraVectorStore);
  });

  it("fromTexts creates store and adds texts", async () => {
    const newStore = await DakeraVectorStore.fromTexts(
      ["text one", "text two"],
      [{ source: "a" }, { source: "b" }],
      {} as never,
      storeOptions,
    );
    expect(newStore).toBeInstanceOf(DakeraVectorStore);
  });

  it("fromTexts accepts shared metadata object", async () => {
    const newStore = await DakeraVectorStore.fromTexts(
      ["text one", "text two"],
      { source: "shared" },
      {} as never,
      storeOptions,
    );
    expect(newStore).toBeInstanceOf(DakeraVectorStore);
  });

  it("hybridSearch forwards alpha as vectorWeight to the client", async () => {
    const results = await store.hybridSearch("coffee", 4, { alpha: 0.3 });
    expect(results).toHaveLength(2);
    expect(results[0]).toBeInstanceOf(Document);
    // Verify the internal client receives vectorWeight, not alpha
    const clientInstance = (store as never as { dakeraClient: { hybridSearch: ReturnType<typeof vi.fn> } }).dakeraClient;
    expect(clientInstance.hybridSearch).toHaveBeenCalledWith(
      "test-ns",
      "coffee",
      expect.objectContaining({ topK: 4, vectorWeight: 0.3 }),
    );
    expect(clientInstance.hybridSearch).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ alpha: expect.anything() }),
    );
  });

  it("hybridSearch defaults vectorWeight to 0.5 when alpha is omitted", async () => {
    await store.hybridSearch("tea", 2);
    const clientInstance = (store as never as { dakeraClient: { hybridSearch: ReturnType<typeof vi.fn> } }).dakeraClient;
    expect(clientInstance.hybridSearch).toHaveBeenCalledWith(
      "test-ns",
      "tea",
      expect.objectContaining({ vectorWeight: 0.5 }),
    );
  });

  it("hybridSearch maps results to Documents with score in metadata", async () => {
    const results = await store.hybridSearch("query", 4);
    expect(results[0]).toBeInstanceOf(Document);
    expect(results[0]!.metadata.score).toBeCloseTo(0.92);
    expect(results[0]!.metadata.id).toBe("h1");
  });
});

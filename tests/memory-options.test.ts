import { describe, it, expect, vi, beforeEach } from "vitest";
import { DakeraError, ErrorCode, NotFoundError } from "@dakera-ai/dakera";
import { DakeraMemory } from "../src/memory.js";

// Capture mock method references so we can assert on call args.
let mockRecall: ReturnType<typeof vi.fn>;
let mockStoreMemory: ReturnType<typeof vi.fn>;

vi.mock("@dakera-ai/dakera", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dakera-ai/dakera")>();
  return {
    // The real error classes, so DakeraMemory can tell a 404 apart.
    NotFoundError: actual.NotFoundError,
    DakeraError: actual.DakeraError,
    ErrorCode: actual.ErrorCode,
    DakeraClient: vi.fn().mockImplementation(function () {
      mockRecall = vi.fn().mockResolvedValue({ memories: [] });
      mockStoreMemory = vi.fn().mockResolvedValue({ memory_id: "m1" });
      return { recall: mockRecall, storeMemory: mockStoreMemory };
    }),
  };
});

describe("DakeraMemory — option forwarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards custom recallK as top_k to client.recall", async () => {
    const memory = new DakeraMemory({
      apiUrl: "http://localhost:3000",
      agentId: "a",
      recallK: 8,
    });
    await memory.loadMemoryVariables({ input: "what is AI?" });
    expect(mockRecall).toHaveBeenCalledWith("a", "what is AI?", {
      top_k: 8,
      neighborhood_mode: "separate",
    });
  });

  it("returns at most recallK ranked memories, without neighbourhood context", async () => {
    const memory = new DakeraMemory({
      apiUrl: "http://localhost:3000",
      agentId: "a",
      recallK: 2,
    });
    // A server before v0.12.3 ignores neighborhood_mode and appends the context inline.
    mockRecall.mockResolvedValueOnce({
      memories: [
        { id: "m1", content: "first", score: 0.9 },
        { id: "n1", content: "context", score: 0, retrieval: "neighborhood" },
        { id: "m2", content: "second", score: 0.8 },
        { id: "m3", content: "third", score: 0.7 },
      ],
    });
    const result = await memory.loadMemoryVariables({ input: "q" });
    expect(result["history"]).toBe("first\nsecond");
  });

  it("omits min_importance from recall opts when minImportance is 0 (default)", async () => {
    const memory = new DakeraMemory({
      apiUrl: "http://localhost:3000",
      agentId: "a",
    });
    await memory.loadMemoryVariables({ input: "query" });
    const [, , opts] = mockRecall.mock.calls[0];
    expect(opts).not.toHaveProperty("min_importance");
    expect(opts.top_k).toBe(5);
  });

  it("passes min_importance to client.recall when minImportance > 0", async () => {
    const memory = new DakeraMemory({
      apiUrl: "http://localhost:3000",
      agentId: "a",
      minImportance: 0.5,
    });
    await memory.loadMemoryVariables({ input: "query" });
    expect(mockRecall).toHaveBeenCalledWith(
      "a",
      "query",
      expect.objectContaining({ min_importance: 0.5 }),
    );
  });

  it("saveContext stores correct Human/AI content format and memory_type", async () => {
    const memory = new DakeraMemory({
      apiUrl: "http://localhost:3000",
      agentId: "a",
    });
    await memory.saveContext({ input: "Hello" }, { output: "Hi there!" });
    expect(mockStoreMemory).toHaveBeenCalledWith("a", {
      content: "Human: Hello\nAI: Hi there!",
      memory_type: "episodic",
      importance: 0.7,
    });
  });

  it("saveContext uses custom importance when provided", async () => {
    const memory = new DakeraMemory({
      apiUrl: "http://localhost:3000",
      agentId: "a",
      importance: 0.9,
    });
    await memory.saveContext({ input: "x" }, { output: "y" });
    expect(mockStoreMemory).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({ importance: 0.9 }),
    );
  });

  it("saveContext stores the turn in sessionId when given", async () => {
    const memory = new DakeraMemory({
      apiUrl: "http://localhost:3000",
      agentId: "a",
      sessionId: "urn:chat:42",
    });
    await memory.saveContext({ input: "x" }, { output: "y" });
    expect(mockStoreMemory).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({ session_id: "urn:chat:42" }),
    );
  });

  it("recalls nothing for an agent an older server does not know yet (404 NAMESPACE_NOT_FOUND)", async () => {
    const memory = new DakeraMemory({ apiUrl: "http://localhost:3000", agentId: "fresh" });
    mockRecall.mockRejectedValueOnce(
      new NotFoundError("Namespace not found: _dakera_agent_fresh", 404, undefined, ErrorCode.NAMESPACE_NOT_FOUND),
    );
    expect(await memory.loadMemoryVariables({ input: "hi" })).toEqual({ history: "" });
  });

  it("rethrows other recall errors", async () => {
    const memory = new DakeraMemory({ apiUrl: "http://localhost:3000", agentId: "a" });
    mockRecall.mockRejectedValueOnce(new NotFoundError("Route not found", 404, undefined, ErrorCode.ROUTE_NOT_FOUND));
    await expect(memory.loadMemoryVariables({ input: "hi" })).rejects.toThrow("Route not found");
    mockRecall.mockRejectedValueOnce(new DakeraError("boom", 500));
    await expect(memory.loadMemoryVariables({ input: "hi" })).rejects.toThrow("boom");
  });
});

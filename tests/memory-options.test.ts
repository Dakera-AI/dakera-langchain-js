import { describe, it, expect, vi, beforeEach } from "vitest";
import { DakeraMemory } from "../src/memory.js";

// Capture mock method references so we can assert on call args.
let mockRecall: ReturnType<typeof vi.fn>;
let mockStoreMemory: ReturnType<typeof vi.fn>;

vi.mock("@dakera-ai/dakera", () => ({
  DakeraClient: vi.fn().mockImplementation(function () {
    mockRecall = vi.fn().mockResolvedValue({ memories: [] });
    mockStoreMemory = vi.fn().mockResolvedValue({ memory_id: "m1" });
    return { recall: mockRecall, storeMemory: mockStoreMemory };
  }),
}));

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
    expect(mockRecall).toHaveBeenCalledWith("a", "what is AI?", { top_k: 8 });
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
});

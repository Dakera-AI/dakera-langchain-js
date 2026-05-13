import { describe, it, expect, vi, beforeEach } from "vitest";
import { DakeraMemory } from "../src/memory.js";

// Mock @dakera-ai/dakera so tests don't need a live server
vi.mock("@dakera-ai/dakera", () => ({
  DakeraClient: vi.fn().mockImplementation(function () {
    return {
      recall: vi.fn().mockResolvedValue({
        memories: [{ content: "Human: hi\nAI: hello", importance: 0.7, score: 0.9 }],
      }),
      storeMemory: vi.fn().mockResolvedValue({ memory_id: "mem_1", status: "ok" }),
    };
  }),
}));

describe("DakeraMemory", () => {
  let memory: DakeraMemory;

  beforeEach(() => {
    memory = new DakeraMemory({
      apiUrl: "http://localhost:3000",
      apiKey: "dk-test",
      agentId: "test-agent",
    });
  });

  it("returns correct memoryVariables", () => {
    expect(memory.memoryVariables).toEqual(["history"]);
  });

  it("returns custom memoryKey", () => {
    const m = new DakeraMemory({
      apiUrl: "http://localhost:3000",
      agentId: "test-agent",
      memoryKey: "chat_history",
    });
    expect(m.memoryVariables).toEqual(["chat_history"]);
  });

  it("loadMemoryVariables recalls and returns history", async () => {
    const result = await memory.loadMemoryVariables({ input: "who are you?" });
    expect(result).toHaveProperty("history");
    expect(typeof result["history"]).toBe("string");
    expect(result["history"]).toContain("Human: hi");
  });

  it("loadMemoryVariables returns empty string for empty input", async () => {
    const result = await memory.loadMemoryVariables({ input: "" });
    expect(result["history"]).toBe("");
  });

  it("saveContext stores the conversation turn", async () => {
    // Should not throw
    await expect(
      memory.saveContext({ input: "Hello" }, { output: "Hi there!" }),
    ).resolves.toBeUndefined();
  });

  it("clear is a no-op and resolves", async () => {
    await expect(memory.clear()).resolves.toBeUndefined();
  });

  it("uses inputKey when specified", async () => {
    const m = new DakeraMemory({
      apiUrl: "http://localhost:3000",
      agentId: "test-agent",
      inputKey: "question",
    });
    const result = await m.loadMemoryVariables({ question: "What is AI?", other: "ignored" });
    expect(result["history"]).toBeDefined();
  });
});

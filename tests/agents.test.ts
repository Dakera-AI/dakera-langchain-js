import { describe, it, expect, vi, beforeEach } from "vitest";
import { DakeraAgentTools } from "../src/agents.js";

vi.mock("@dakera-ai/dakera", () => ({
  DakeraClient: vi.fn().mockImplementation(function () {
    return {
      agentStats: vi.fn().mockResolvedValue({ total_memories: 42, active_sessions: 1 }),
      agentMemories: vi.fn().mockResolvedValue([
        { id: "m1", content: "Hello", importance: 0.8, memory_type: "episodic", created_at: "2026-01-01" },
        { id: "m2", content: "World", importance: 0.5, memory_type: "semantic", created_at: "2026-01-02" },
      ]),
      agentSessions: vi.fn().mockResolvedValue([
        { id: "s1", started_at: 100, ended_at: 200 },
      ]),
      importMemories: vi.fn().mockResolvedValue({ imported: 3 }),
      exportMemories: vi.fn().mockResolvedValue({ data: [{ id: "m1", content: "test" }] }),
    };
  }),
}));

describe("DakeraAgentTools", () => {
  let agent: DakeraAgentTools;

  beforeEach(() => {
    agent = new DakeraAgentTools({
      apiUrl: "http://localhost:3000",
      apiKey: "dk-test",
      agentId: "test-agent",
    });
  });

  it("gets agent stats", async () => {
    const stats = await agent.stats();
    expect(stats).toEqual({ total_memories: 42, active_sessions: 1 });
  });

  it("lists agent memories", async () => {
    const mems = await agent.memories({ limit: 10 });
    expect(mems).toHaveLength(2);
    expect(mems[0].id).toBe("m1");
    expect(mems[0].content).toBe("Hello");
    expect(mems[0].memoryType).toBe("episodic");
  });

  it("lists agent memories with defaults", async () => {
    const mems = await agent.memories();
    expect(mems).toHaveLength(2);
  });

  it("lists agent sessions", async () => {
    const sessions = await agent.sessions(true);
    expect(sessions).toHaveLength(1);
  });

  it("imports memories", async () => {
    const result = await agent.importMemories([{ content: "test" }]);
    expect(result).toEqual({ imported: 3 });
  });

  it("exports memories", async () => {
    const result = await agent.exportMemories();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: "m1", content: "test" });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { DakeraSessionManager } from "../src/sessions.js";

vi.mock("@dakera-ai/dakera", () => ({
  DakeraClient: vi.fn().mockImplementation(function () {
    return {
      startSession: vi.fn().mockResolvedValue({ id: "sess_123" }),
      endSession: vi.fn().mockResolvedValue(undefined),
      getSession: vi.fn().mockResolvedValue({
        id: "sess_123",
        agent_id: "test-agent",
        started_at: 1700000000,
        ended_at: undefined,
        metadata: { type: "test" },
        memory_count: 5,
      }),
      listSessions: vi.fn().mockResolvedValue([
        { id: "s1", agent_id: "a", started_at: 100, ended_at: 200, metadata: {}, memory_count: 3 },
        { id: "s2", agent_id: "a", started_at: 300, ended_at: undefined, metadata: {}, memory_count: 0 },
      ]),
      sessionMemories: vi.fn().mockResolvedValue([
        { id: "m1", content: "Hello", importance: 0.8 },
        { id: "m2", content: "World", importance: 0.5 },
      ]),
    };
  }),
}));

describe("DakeraSessionManager", () => {
  let sessions: DakeraSessionManager;

  beforeEach(() => {
    sessions = new DakeraSessionManager({
      apiUrl: "http://localhost:3000",
      apiKey: "dk-test",
      agentId: "test-agent",
    });
  });

  it("starts a session and returns id", async () => {
    const id = await sessions.start({ type: "test" });
    expect(id).toBe("sess_123");
    expect(sessions.currentSessionId).toBe("sess_123");
  });

  it("ends a session and clears active id", async () => {
    await sessions.start();
    await sessions.end();
    expect(sessions.currentSessionId).toBeNull();
  });

  it("throws when ending without active session", async () => {
    await expect(sessions.end()).rejects.toThrow("No active session to end");
  });

  it("gets session details", async () => {
    const info = await sessions.get("sess_123");
    expect(info.id).toBe("sess_123");
    expect(info.agentId).toBe("test-agent");
    expect(info.memoryCount).toBe(5);
    expect(info.metadata).toEqual({ type: "test" });
  });

  it("lists sessions", async () => {
    const list = await sessions.list(true);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe("s1");
    expect(list[0].memoryCount).toBe(3);
  });

  it("retrieves session memories", async () => {
    const mems = await sessions.memories("sess_123");
    expect(mems).toHaveLength(2);
    expect(mems[0]).toEqual({ id: "m1", content: "Hello", importance: 0.8 });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DakeraAgentTools } from "../src/agents.js";

vi.mock("@dakera-ai/dakera", () => ({
  DakeraError: class DakeraError extends Error {
    constructor(
      message: string,
      public statusCode?: number,
      public responseBody?: unknown,
    ) {
      super(message);
    }
  },
  DakeraClient: vi.fn().mockImplementation(function () {
    return {
      agentStats: vi.fn().mockResolvedValue({ total_memories: 42, active_sessions: 1 }),
      agentMemories: vi.fn().mockResolvedValue([
        { id: "m1", content: "Hello", importance: 0.8, memory_type: "episodic", created_at: 1793000000, tags: ["greeting"] },
        { id: "m2", content: "World", importance: 0.5, memory_type: "semantic", created_at: "2026-01-02" },
      ]),
      agentSessions: vi.fn().mockResolvedValue([
        { id: "s1", started_at: 100, ended_at: 200 },
      ]),
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

  it("maps tags and the Unix created_at of listed memories", async () => {
    const mems = await agent.memories();
    expect(mems[0].tags).toEqual(["greeting"]);
    expect(mems[0].createdAt).toBe(1793000000);
    expect(mems[1].tags).toEqual([]);
  });

  describe("import / export", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("uploads a JSON-lines file with agent_id and format in the query", async () => {
      const job = {
        job_id: "j1",
        status: "done",
        format: "jsonl",
        total: 2,
        imported: 2,
        skipped: 0,
        errors: [],
        started_at: 1,
      };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(job), { status: 200 }));
      const result = await agent.importMemories([
        { content: "one" },
        { id: "keep-id", content: "two", agent_id: "someone-else", tags: ["t"] },
      ]);
      expect(result).toEqual(job);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:3000/v1/import?agent_id=test-agent&format=jsonl");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ Authorization: "Bearer dk-test" });
      const file = (init.body as FormData).get("file") as File;
      expect(file.name).toBe("memories.jsonl");
      const lines = (await file.text()).split("\n").map((l) => JSON.parse(l));
      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatchObject({ content: "one", agent_id: "test-agent" });
      expect(typeof lines[0].id).toBe("string");
      expect(typeof lines[0].created_at).toBe("number");
      expect(typeof lines[0].last_accessed_at).toBe("number");
      expect(lines[1]).toMatchObject({ id: "keep-id", content: "two", agent_id: "test-agent", tags: ["t"] });
    });

    it("reads the JSON-lines export", async () => {
      fetchMock.mockResolvedValue(
        new Response('{"id":"m1","content":"a"}\n{"id":"m2","content":"b"}\n', { status: 200 }),
      );
      const result = await agent.exportMemories();
      expect(result).toEqual([
        { id: "m1", content: "a" },
        { id: "m2", content: "b" },
      ]);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:3000/v1/export?agent_id=test-agent&format=jsonl");
      expect(init.method).toBe("GET");
    });

    it("sends no Authorization header without an API key", async () => {
      const anon = new DakeraAgentTools({ apiUrl: "http://localhost:3000/", agentId: "a" });
      fetchMock.mockResolvedValue(new Response("", { status: 200 }));
      await expect(anon.exportMemories()).resolves.toEqual([]);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:3000/v1/export?agent_id=a&format=jsonl");
      expect(init.headers).toEqual({});
    });

    it("throws a DakeraError with the server's message", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ error: "missing field `id`", code: "INVALID_REQUEST" }), {
          status: 400,
        }),
      );
      await expect(agent.importMemories([{ content: "x" }])).rejects.toMatchObject({
        message: "missing field `id`",
        statusCode: 400,
      });
    });
  });
});

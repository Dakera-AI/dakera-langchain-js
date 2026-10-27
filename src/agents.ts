/**
 * DakeraAgentTools — agent statistics and management via Dakera.
 *
 * @example
 * ```typescript
 * import { DakeraAgentTools } from "@dakera-ai/langchain";
 *
 * const agent = new DakeraAgentTools({
 *   apiUrl: "http://localhost:3300",
 *   apiKey: "dk-...",
 *   agentId: "my-agent",
 * });
 *
 * const stats = await agent.stats();
 * const memories = await agent.memories({ limit: 20 });
 * ```
 */

import { DakeraClient, DakeraError } from "@dakera-ai/dakera";

export interface DakeraAgentToolsOptions {
  apiUrl: string;
  apiKey?: string;
  agentId: string;
}

export interface AgentMemory {
  id: string;
  content: string;
  importance: number;
  memoryType: string;
  tags: string[];
  /** Creation time: Unix seconds from a v0.12 server (`""` when absent). */
  createdAt: number | string;
}

/** Status of an import job (`POST /v1/import`). */
export interface MemoryImportJob {
  job_id: string;
  status: string;
  format: string;
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
  started_at: number;
  finished_at?: number;
}

export class DakeraAgentTools {
  private readonly client: DakeraClient;
  private readonly agentId: string;
  private readonly apiUrl: string;
  private readonly apiKey: string | undefined;

  constructor(options: DakeraAgentToolsOptions) {
    this.client = new DakeraClient({
      baseUrl: options.apiUrl,
      ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
    });
    this.agentId = options.agentId;
    this.apiUrl = options.apiUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
  }

  async stats(): Promise<unknown> {
    return this.client.agentStats(this.agentId);
  }

  async memories(options?: { limit?: number; offset?: number }): Promise<AgentMemory[]> {
    const result = await this.client.agentMemories(this.agentId, options);
    return result.map((m) => ({
      id: m.id,
      content: m.content,
      importance: m.importance,
      memoryType: m.memory_type,
      tags: (m as { tags?: string[] }).tags ?? [],
      createdAt: m.created_at ?? "",
    }));
  }

  async sessions(activeOnly = false): Promise<unknown[]> {
    return this.client.agentSessions(this.agentId, { active_only: activeOnly });
  }

  /**
   * Import memories into the agent (`POST /v1/import`). Each object is one line
   * of Dakera's JSON-lines format, as `exportMemories()` returns it; only
   * `content` is needed: a missing `id` is generated, `agent_id` is this agent
   * and `created_at` / `last_accessed_at` default to now. Returns the import
   * job's status.
   *
   * The server takes a `multipart/form-data` file with `agent_id` and `format`
   * in the query; `DakeraClient.importMemories()` (SDK 0.12.3) posts JSON,
   * which the server refuses, so the upload is made here.
   */
  async importMemories(memories: Record<string, unknown>[]): Promise<MemoryImportJob> {
    const now = Math.floor(Date.now() / 1000);
    const jsonl = memories
      .map((m) =>
        JSON.stringify({
          id: crypto.randomUUID(),
          created_at: now,
          last_accessed_at: now,
          ...m,
          agent_id: this.agentId,
        }),
      )
      .join("\n");
    const form = new FormData();
    form.append("file", new Blob([jsonl], { type: "application/x-ndjson" }), "memories.jsonl");
    const params = new URLSearchParams({ agent_id: this.agentId, format: "jsonl" });
    const response = await this.transfer("POST", `/v1/import?${params}`, form);
    return (await response.json()) as MemoryImportJob;
  }

  /**
   * Export the agent's memories (`GET /v1/export`), one object per memory.
   *
   * The server answers the JSON-lines file itself; `DakeraClient.exportMemories()`
   * (SDK 0.12.3) expects a JSON wrapper and returns no memories, so the file
   * is read here.
   */
  async exportMemories(): Promise<Record<string, unknown>[]> {
    const params = new URLSearchParams({ agent_id: this.agentId, format: "jsonl" });
    const response = await this.transfer("GET", `/v1/export?${params}`);
    const text = await response.text();
    return text
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  private async transfer(method: string, path: string, body?: FormData): Promise<Response> {
    const headers: Record<string, string> = {};
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;
    const response = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
    });
    if (!response.ok) {
      const text = await response.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        // keep the raw text
      }
      const message =
        typeof parsed === "object" && parsed !== null && "error" in parsed
          ? String((parsed as { error: unknown }).error)
          : `HTTP ${response.status}`;
      throw new DakeraError(message, response.status, parsed);
    }
    return response;
  }
}

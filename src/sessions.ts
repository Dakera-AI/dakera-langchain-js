/**
 * DakeraSessionManager — conversation session tracking via Dakera.
 *
 * @example
 * ```typescript
 * import { DakeraSessionManager } from "@dakera-ai/langchain";
 *
 * const sessions = new DakeraSessionManager({
 *   apiUrl: "https://api.dakera.ai",
 *   apiKey: "dk-...",
 *   agentId: "my-agent",
 * });
 *
 * const sessionId = await sessions.start({ type: "support-chat" });
 * // ... store memories within this session ...
 * await sessions.end("Resolved billing question");
 * ```
 */

import { DakeraClient } from "@dakera-ai/dakera";

export interface DakeraSessionManagerOptions {
  apiUrl: string;
  apiKey?: string;
  agentId: string;
}

export interface SessionInfo {
  id: string;
  agentId: string;
  startedAt: number;
  endedAt: number | null;
  metadata: Record<string, unknown>;
  memoryCount: number;
}

export interface SessionMemory {
  id: string;
  content: string;
  importance: number;
  tags: string[];
}

export class DakeraSessionManager {
  private readonly client: DakeraClient;
  private readonly agentId: string;
  private activeSessionId: string | null = null;

  constructor(options: DakeraSessionManagerOptions) {
    this.client = new DakeraClient({
      baseUrl: options.apiUrl,
      ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
    });
    this.agentId = options.agentId;
  }

  get currentSessionId(): string | null {
    return this.activeSessionId;
  }

  async start(metadata?: Record<string, unknown>): Promise<string> {
    const result = await this.client.startSession(this.agentId, { metadata });
    this.activeSessionId = result.session_id;
    return result.session_id;
  }

  async end(summary?: string): Promise<void> {
    if (!this.activeSessionId) {
      throw new Error("No active session to end");
    }
    await this.client.endSession(this.activeSessionId, { summary });
    this.activeSessionId = null;
  }

  async get(sessionId: string): Promise<SessionInfo> {
    const result = await this.client.getSession(sessionId);
    return {
      id: result.id,
      agentId: result.agent_id,
      startedAt: result.started_at,
      endedAt: result.ended_at,
      metadata: result.metadata ?? {},
      memoryCount: result.memory_count,
    };
  }

  async list(activeOnly = false): Promise<SessionInfo[]> {
    const result = await this.client.listSessions(this.agentId, { active_only: activeOnly });
    return (result.sessions ?? []).map((s) => ({
      id: s.id,
      agentId: s.agent_id,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      metadata: s.metadata ?? {},
      memoryCount: s.memory_count,
    }));
  }

  async memories(sessionId: string): Promise<SessionMemory[]> {
    const result = await this.client.sessionMemories(sessionId);
    return (result.memories ?? []).map((m) => ({
      id: m.id,
      content: m.content,
      importance: m.importance,
      tags: m.tags ?? [],
    }));
  }
}

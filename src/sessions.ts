/**
 * DakeraSessionManager — conversation session tracking via Dakera.
 *
 * @example
 * ```typescript
 * import { DakeraSessionManager } from "@dakera-ai/langchain";
 *
 * const sessions = new DakeraSessionManager({
 *   apiUrl: "http://localhost:3300",
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
  startedAt: number | undefined;
  endedAt: number | undefined;
  metadata: Record<string, unknown>;
  memoryCount: number | undefined;
  /** Summary stored when the session ended. */
  summary: string | undefined;
  /** Why the session ended: `"client"` (`end()`) or `"idle"` (server idle timeout). */
  endedReason: string | undefined;
}

export interface SessionMemory {
  id: string;
  content: string;
  importance: number;
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

  /**
   * Start a session. The server ends a session after a period without activity
   * (4 h by default); `idleTimeoutSecs` sets this session's timeout (`0`: never).
   */
  async start(
    metadata?: Record<string, unknown>,
    options?: { idleTimeoutSecs?: number },
  ): Promise<string> {
    const result =
      options?.idleTimeoutSecs !== undefined
        ? await this.client.startSession(this.agentId, metadata, {
            idle_timeout_secs: options.idleTimeoutSecs,
          })
        : await this.client.startSession(this.agentId, metadata);
    this.activeSessionId = result.id;
    return result.id;
  }

  /** End the active session, storing `summary` on it when given. */
  async end(summary?: string): Promise<void> {
    if (!this.activeSessionId) {
      throw new Error("No active session to end");
    }
    await this.client.endSession(
      this.activeSessionId,
      summary !== undefined ? { summary } : undefined,
    );
    this.activeSessionId = null;
  }

  /**
   * Record activity on the active session so the server's idle timeout does not
   * end it. Returns `false` when the session had already ended (an ended session
   * is never re-opened).
   */
  async touch(): Promise<boolean> {
    if (!this.activeSessionId) {
      throw new Error("No active session to touch");
    }
    const result = await this.client.touchSession(this.activeSessionId);
    return result.session_state === "active";
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
      summary: result.summary,
      endedReason: result.ended_reason,
    };
  }

  async list(activeOnly = false): Promise<SessionInfo[]> {
    const result = await this.client.listSessions({
      agent_id: this.agentId,
      active_only: activeOnly,
    });
    return result.map((s) => ({
      id: s.id,
      agentId: s.agent_id,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      metadata: s.metadata ?? {},
      memoryCount: s.memory_count,
      summary: s.summary,
      endedReason: s.ended_reason,
    }));
  }

  async memories(sessionId: string): Promise<SessionMemory[]> {
    const result = await this.client.sessionMemories(sessionId);
    return result.map((m) => ({
      id: m.id,
      content: m.content,
      importance: m.importance,
    }));
  }
}

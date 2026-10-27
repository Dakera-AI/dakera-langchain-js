/**
 * DakeraSessionManager — conversation session tracking via Dakera.
 *
 * @example
 * ```typescript
 * import { DakeraSessionManager } from "@dakera-ai/langchain";
 *
 * const sessions = new DakeraSessionManager({
 *   apiUrl: "http://localhost:3000",
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

/** Options for {@link DakeraSessionManager}. */
export interface DakeraSessionManagerOptions {
  /** Dakera server URL, e.g. `http://localhost:3000`. */
  apiUrl: string;
  /** Dakera API key; omit for a server running without auth. */
  apiKey?: string;
  /** Agent that owns the sessions. */
  agentId: string;
}

/** A session as {@link DakeraSessionManager.get} and {@link DakeraSessionManager.list} return it. */
export interface SessionInfo {
  /** Session id. */
  id: string;
  /** Agent that owns the session. */
  agentId: string;
  /** Start time (Unix seconds). */
  startedAt: number | undefined;
  /** End time (Unix seconds); `undefined` while the session is active. */
  endedAt: number | undefined;
  /** Metadata given to {@link DakeraSessionManager.start}. */
  metadata: Record<string, unknown>;
  /** Number of memories stored in the session. */
  memoryCount: number | undefined;
  /** Summary stored when the session ended. */
  summary: string | undefined;
  /** Why the session ended: `"client"` (`end()`) or `"idle"` (server idle timeout). */
  endedReason: string | undefined;
}

/** A memory stored in a session ({@link DakeraSessionManager.memories}). */
export interface SessionMemory {
  /** Memory id. */
  id: string;
  /** Memory text. */
  content: string;
  /** Importance score (0 – 1). */
  importance: number;
}

/**
 * Starts, ends and lists an agent's Dakera sessions. A session groups the
 * memories stored while it is active; the manager tracks the session it started
 * last as the active one.
 */
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

  /** Id of the session started by {@link start} and not yet ended, else `null`. */
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

  /**
   * End the active session, storing `summary` on it when given. Ending needs a
   * key with write access to the agent's namespace (server v0.12.2+).
   */
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

  /** Read one session (`GET /v1/sessions/{id}`). */
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

  /** List the agent's sessions, only the active ones with `activeOnly`. */
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

  /** List the memories stored in a session. */
  async memories(sessionId: string): Promise<SessionMemory[]> {
    const result = await this.client.sessionMemories(sessionId);
    return result.map((m) => ({
      id: m.id,
      content: m.content,
      importance: m.importance,
    }));
  }
}

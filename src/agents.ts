/**
 * DakeraAgentTools — agent statistics and management via Dakera.
 *
 * @example
 * ```typescript
 * import { DakeraAgentTools } from "@dakera-ai/langchain";
 *
 * const agent = new DakeraAgentTools({
 *   apiUrl: "https://api.dakera.ai",
 *   apiKey: "dk-...",
 *   agentId: "my-agent",
 * });
 *
 * const stats = await agent.stats();
 * const memories = await agent.memories({ limit: 20 });
 * ```
 */

import { DakeraClient } from "@dakera-ai/dakera";

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
  createdAt: string;
}

export class DakeraAgentTools {
  private readonly client: DakeraClient;
  private readonly agentId: string;

  constructor(options: DakeraAgentToolsOptions) {
    this.client = new DakeraClient({
      baseUrl: options.apiUrl,
      ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
    });
    this.agentId = options.agentId;
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
      tags: [],
      createdAt: m.created_at ?? "",
    }));
  }

  async sessions(activeOnly = false): Promise<unknown[]> {
    return this.client.agentSessions(this.agentId, { active_only: activeOnly });
  }

  async importMemories(memories: Record<string, unknown>[]): Promise<unknown> {
    return this.client.importMemories(memories, "jsonl", this.agentId);
  }

  async exportMemories(): Promise<unknown[]> {
    const result = await this.client.exportMemories("jsonl", this.agentId);
    return result.data ?? [];
  }
}

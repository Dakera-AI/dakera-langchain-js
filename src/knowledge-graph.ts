/**
 * DakeraKnowledgeGraph — knowledge graph operations via Dakera.
 *
 * @example
 * ```typescript
 * import { DakeraKnowledgeGraph } from "@dakera-ai/langchain";
 *
 * const kg = new DakeraKnowledgeGraph({
 *   apiUrl: "http://localhost:3300",
 *   apiKey: "dk-...",
 *   agentId: "my-agent",
 * });
 *
 * const graph = await kg.build(memoryId);
 * const results = await kg.query();
 * ```
 */

import {
  DakeraClient,
  type AgentId,
  type MemoryId,
  agentId,
} from "@dakera-ai/dakera";

export interface DakeraKnowledgeGraphOptions {
  apiUrl: string;
  apiKey?: string;
  agentId: string;
}

export interface GraphResult {
  edges: unknown[];
  nodeCount: number;
  edgeCount: number;
}

/** Answer of `summarize()`: the stored summary memory and how many memories it covers. */
export interface KnowledgeSummary {
  summary_memory: { id: string; content: string } & Record<string, unknown>;
  source_count: number;
}

export class DakeraKnowledgeGraph {
  private readonly client: DakeraClient;
  private readonly agentId: string;

  constructor(options: DakeraKnowledgeGraphOptions) {
    this.client = new DakeraClient({
      baseUrl: options.apiUrl,
      ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
    });
    this.agentId = options.agentId;
  }

  async query(options?: {
    rootId?: string;
    edgeType?: string;
    maxDepth?: number;
    limit?: number;
  }): Promise<GraphResult> {
    const result = await this.client.knowledgeQuery(this.agentId, options);
    return {
      edges: result.edges ?? [],
      nodeCount: result.node_count,
      edgeCount: result.edge_count,
    };
  }

  async path(fromId: string, toId: string): Promise<unknown> {
    return this.client.knowledgePath(this.agentId, fromId, toId);
  }

  async link(memoryId: string, entityId: string, relation?: string): Promise<void> {
    // The server requires the owning agent and records every explicit link as `linked_by`;
    // `relation` is sent as an informational label only (the server does not store it).
    await this.client.memoryLink(memoryId, entityId, {
      agentId: this.agentId,
      ...(relation !== undefined ? { label: relation } : {}),
    });
  }

  async export(format?: string): Promise<GraphResult> {
    const result = await this.client.knowledgeExport(this.agentId, format);
    return {
      edges: result.edges ?? [],
      nodeCount: result.node_count,
      edgeCount: result.edge_count,
    };
  }

  /**
   * Build the knowledge graph around a seed memory (`POST /v1/knowledge/graph`).
   * The server requires the seed `memoryId`.
   */
  async build(
    memoryId: string,
    options?: { depth?: number; minSimilarity?: number },
  ): Promise<unknown> {
    // The server answers `{ root, total_nodes }` (a tree around the seed), not
    // the SDK's `KnowledgeGraphResponse` type, so the answer is returned as is.
    if (!memoryId) {
      throw new Error("build() needs the seed memory id");
    }
    return this.client.knowledgeGraph({
      agent_id: agentId(this.agentId) as AgentId,
      memory_id: memoryId as MemoryId,
      ...(options?.depth !== undefined ? { depth: options.depth } : {}),
      ...(options?.minSimilarity !== undefined ? { min_similarity: options.minSimilarity } : {}),
    });
  }

  /**
   * Summarize memories into a new memory (`POST /v1/knowledge/summarize`). The
   * server requires the ids of the memories to summarize (at least two) and
   * always stores the summary.
   */
  async summarize(
    memoryIds: string[],
    options?: { targetType?: string },
  ): Promise<KnowledgeSummary> {
    if (memoryIds.length < 2) {
      throw new Error("summarize() needs at least two memory ids");
    }
    // The server answers `{ summary_memory, source_count }`; the SDK's
    // `SummarizeResponse` type (`summary`, `new_memory_id`) does not match it.
    return this.client.summarize({
      agent_id: agentId(this.agentId) as AgentId,
      memory_ids: memoryIds as MemoryId[],
      ...(options?.targetType !== undefined ? { target_type: options.targetType } : {}),
    }) as unknown as Promise<KnowledgeSummary>;
  }

  async deduplicate(): Promise<unknown> {
    return this.client.deduplicate({
      agent_id: agentId(this.agentId) as AgentId,
    });
  }
}

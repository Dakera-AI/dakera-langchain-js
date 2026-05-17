/**
 * DakeraKnowledgeGraph — knowledge graph operations via Dakera.
 *
 * @example
 * ```typescript
 * import { DakeraKnowledgeGraph } from "@dakera-ai/langchain";
 *
 * const kg = new DakeraKnowledgeGraph({
 *   apiUrl: "https://api.dakera.ai",
 *   apiKey: "dk-...",
 *   agentId: "my-agent",
 * });
 *
 * const graph = await kg.build();
 * const results = await kg.query();
 * ```
 */

import { DakeraClient, type AgentId, agentId } from "@dakera-ai/dakera";

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
    await this.client.memoryLink(
      memoryId,
      entityId,
      (relation ?? "related_to") as "related_to",
    );
  }

  async export(format?: string): Promise<GraphResult> {
    const result = await this.client.knowledgeExport(this.agentId, format);
    return {
      edges: result.edges ?? [],
      nodeCount: result.node_count,
      edgeCount: result.edge_count,
    };
  }

  async build(): Promise<unknown> {
    return this.client.knowledgeGraph({
      agent_id: agentId(this.agentId) as AgentId,
    });
  }

  async summarize(): Promise<unknown> {
    return this.client.summarize({
      agent_id: agentId(this.agentId) as AgentId,
    });
  }

  async deduplicate(): Promise<unknown> {
    return this.client.deduplicate({
      agent_id: agentId(this.agentId) as AgentId,
    });
  }
}

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
 * const results = await kg.query("What entities relate to project X?");
 * ```
 */

import { DakeraClient } from "@dakera-ai/dakera";

export interface DakeraKnowledgeGraphOptions {
  apiUrl: string;
  apiKey?: string;
  agentId: string;
}

export interface GraphResult {
  nodes: unknown[];
  edges: unknown[];
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

  async query(query: string): Promise<GraphResult> {
    const result = await this.client.knowledgeQuery(this.agentId, { query });
    return { nodes: result.nodes ?? [], edges: result.edges ?? [] };
  }

  async traverse(entityId: string, depth = 2, direction = "both"): Promise<GraphResult> {
    const result = await this.client.knowledgePath(this.agentId, {
      source: entityId,
      depth,
      direction,
    });
    return { nodes: result.nodes ?? [], edges: result.edges ?? [] };
  }

  async link(memoryId: string, entityId: string, relation = "relates_to"): Promise<void> {
    await this.client.memoryLink(this.agentId, {
      memory_id: memoryId,
      entity_id: entityId,
      relation,
    });
  }

  async export(): Promise<GraphResult> {
    const result = await this.client.knowledgeExport(this.agentId);
    return { nodes: result.nodes ?? [], edges: result.edges ?? [] };
  }

  async build(): Promise<GraphResult> {
    const result = await this.client.knowledgeGraph(this.agentId);
    return { nodes: result.nodes ?? [], edges: result.edges ?? [] };
  }

  async summarize(): Promise<unknown> {
    return this.client.summarize(this.agentId);
  }

  async deduplicate(): Promise<unknown> {
    return this.client.deduplicate(this.agentId);
  }
}

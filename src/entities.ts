/**
 * DakeraEntityExtractor — named entity extraction via Dakera.
 *
 * @example
 * ```typescript
 * import { DakeraEntityExtractor } from "@dakera-ai/langchain";
 *
 * const extractor = new DakeraEntityExtractor({
 *   apiUrl: "http://localhost:3300",
 *   apiKey: "dk-...",
 *   agentId: "my-agent",
 * });
 *
 * const entities = await extractor.extract("Apple released iOS 18 in California");
 * // [{ type: "ORG", value: "Apple", confidence: 0.95 }, ...]
 * ```
 */

import { DakeraClient, NotFoundError } from "@dakera-ai/dakera";

export interface DakeraEntityExtractorOptions {
  apiUrl: string;
  apiKey?: string;
  agentId: string;
}

export interface Entity {
  type: string;
  value: string;
  confidence: number;
}

export class DakeraEntityExtractor {
  private readonly client: DakeraClient;
  private readonly agentId: string;

  constructor(options: DakeraEntityExtractorOptions) {
    this.client = new DakeraClient({
      baseUrl: options.apiUrl,
      ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
    });
    this.agentId = options.agentId;
  }

  async extract(text: string): Promise<Entity[]> {
    const result = await this.client.extractEntities(text);
    return (result.entities ?? []).map((e) => ({
      type: e.entity_type,
      value: e.value,
      confidence: e.score,
    }));
  }

  async memoryEntities(memoryId: string): Promise<Entity[]> {
    const result = await this.client.memoryEntities(memoryId);
    return (result.entities ?? []).map((e) => ({
      type: e.entity_type,
      value: e.value,
      confidence: e.score,
    }));
  }

  /**
   * Turn on entity extraction for the agent's memories, optionally limited to
   * `entityTypes`. The setting lives on the agent's memory namespace
   * (`_dakera_agent_<agentId>`); an agent that has stored nothing yet is
   * created first (server v0.12.2+).
   */
  async configure(entityTypes?: string[]): Promise<void> {
    const config: { extract_entities: boolean; entity_types?: string[] } = {
      extract_entities: true,
    };
    if (entityTypes !== undefined) {
      config.entity_types = entityTypes;
    }
    const namespace = `_dakera_agent_${this.agentId}`;
    try {
      await this.client.configureNamespaceNer(namespace, config);
    } catch (err) {
      if (!(err instanceof NotFoundError)) throw err;
      await this.client.createAgent(this.agentId);
      await this.client.configureNamespaceNer(namespace, config);
    }
  }
}

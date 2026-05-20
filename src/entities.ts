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

import { DakeraClient } from "@dakera-ai/dakera";

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

  async configure(entityTypes?: string[]): Promise<void> {
    const config: { extract_entities: boolean; entity_types?: string[] } = {
      extract_entities: true,
    };
    if (entityTypes !== undefined) {
      config.entity_types = entityTypes;
    }
    await this.client.configureNamespaceNer(this.agentId, config);
  }
}

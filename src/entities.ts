/**
 * DakeraEntityExtractor — named entity extraction via Dakera.
 *
 * @example
 * ```typescript
 * import { DakeraEntityExtractor } from "@dakera-ai/langchain";
 *
 * const extractor = new DakeraEntityExtractor({
 *   apiUrl: "https://api.dakera.ai",
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
    const result = await this.client.extractEntities(this.agentId, { text });
    return (result.entities ?? []).map((e) => ({
      type: e.entity_type,
      value: e.value,
      confidence: e.confidence,
    }));
  }

  async memoryEntities(memoryId: string): Promise<Entity[]> {
    const result = await this.client.memoryEntities(this.agentId, { memory_id: memoryId });
    return (result.entities ?? []).map((e) => ({
      type: e.entity_type,
      value: e.value,
      confidence: e.confidence,
    }));
  }

  async configure(entityTypes?: string[]): Promise<void> {
    await this.client.configureNamespaceNer(this.agentId, { entity_types: entityTypes });
  }
}

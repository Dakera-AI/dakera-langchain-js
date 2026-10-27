/**
 * DakeraEntityExtractor — named entity extraction via Dakera.
 *
 * @example
 * ```typescript
 * import { DakeraEntityExtractor } from "@dakera-ai/langchain";
 *
 * const extractor = new DakeraEntityExtractor({
 *   apiUrl: "http://localhost:3000",
 *   apiKey: "dk-...",
 *   agentId: "my-agent",
 * });
 *
 * const entities = await extractor.extract("Email alice@example.com on March 1, 2026");
 * // [{ type: "email", value: "alice@example.com", confidence: 1 }, { type: "date", ... }]
 * ```
 */

import { DakeraClient, NotFoundError } from "@dakera-ai/dakera";

/** Options for {@link DakeraEntityExtractor}. */
export interface DakeraEntityExtractorOptions {
  /** Dakera server URL, e.g. `http://localhost:3000`. */
  apiUrl: string;
  /** Dakera API key; omit for a server running without auth. */
  apiKey?: string;
  /** Agent whose memories {@link DakeraEntityExtractor.configure} applies to. */
  agentId: string;
}

/** A named entity found in a text or a memory. */
export interface Entity {
  /** Entity type, e.g. `"date"`, `"email"`, `"url"`, `"person"`, `"organization"`. */
  type: string;
  /** The entity's text. */
  value: string;
  /** Extraction confidence (0 – 1). */
  confidence: number;
}

/** Entity extraction with the server's built-in extractors (no external service). */
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

  /**
   * Extract the entities in `text` with the server's rule-based extractor
   * (dates, emails, URLs, ...); nothing is stored.
   */
  async extract(text: string): Promise<Entity[]> {
    const result = await this.client.extractEntities(text);
    return (result.entities ?? []).map((e) => ({
      type: e.entity_type,
      value: e.value,
      confidence: e.score,
    }));
  }

  /** Entities extracted from a stored memory (needs extraction turned on with {@link configure}). */
  async memoryEntities(memoryId: string): Promise<Entity[]> {
    const result = await this.client.memoryEntities(memoryId);
    return (result.entities ?? []).map((e) => ({
      type: e.entity_type,
      value: e.value,
      confidence: e.score,
    }));
  }

  /**
   * Turn on entity extraction for the agent's memories. `entityTypes` (e.g.
   * `["person", "organization", "location"]`) are extracted by the server's
   * neural extractor. The setting lives on the agent's memory namespace
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

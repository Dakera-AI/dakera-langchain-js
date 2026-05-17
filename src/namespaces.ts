/**
 * DakeraNamespaceManager — namespace CRUD operations via Dakera.
 *
 * @example
 * ```typescript
 * import { DakeraNamespaceManager } from "@dakera-ai/langchain";
 *
 * const ns = new DakeraNamespaceManager({
 *   apiUrl: "https://api.dakera.ai",
 *   apiKey: "dk-...",
 * });
 *
 * await ns.create("my-namespace", { dimensions: 384, indexType: "hnsw" });
 * const all = await ns.list();
 * ```
 */

import { DakeraClient } from "@dakera-ai/dakera";

export interface DakeraNamespaceManagerOptions {
  apiUrl: string;
  apiKey?: string;
}

export interface NamespaceInfo {
  name: string;
  dimension: number | undefined;
  vectorCount: number;
}

export class DakeraNamespaceManager {
  private readonly client: DakeraClient;

  constructor(options: DakeraNamespaceManagerOptions) {
    this.client = new DakeraClient({
      baseUrl: options.apiUrl,
      ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
    });
  }

  async create(
    name: string,
    options?: { dimensions?: number; indexType?: string; metadata?: Record<string, unknown> },
  ): Promise<unknown> {
    return this.client.createNamespace(name, options);
  }

  async get(name: string): Promise<NamespaceInfo> {
    const result = await this.client.getNamespace(name);
    return {
      name: result.namespace,
      dimension: result.dimension,
      vectorCount: result.vector_count,
    };
  }

  async list(): Promise<NamespaceInfo[]> {
    const result = await this.client.listNamespaces();
    return result.map((ns) => ({
      name: ns.namespace,
      dimension: ns.dimension,
      vectorCount: ns.vector_count,
    }));
  }

  async configure(name: string, config: { dimension: number; distance?: string }): Promise<void> {
    await this.client.configureNamespace(name, {
      dimension: config.dimension,
      ...(config.distance !== undefined
        ? { distance: config.distance as "cosine" | "euclidean" | "dot_product" }
        : {}),
    });
  }

  async delete(name: string): Promise<void> {
    await this.client.deleteNamespace(name);
  }

  async stats(name: string): Promise<unknown> {
    return this.client.getIndexStats(name);
  }
}

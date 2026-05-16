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
 * await ns.create("my-namespace", { dimension: 384, metric: "cosine" });
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
  dimension: number;
  metric?: string;
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
    options?: { dimension?: number; metric?: string },
  ): Promise<unknown> {
    return this.client.createNamespace(name, options);
  }

  async get(name: string): Promise<NamespaceInfo> {
    const result = await this.client.getNamespace(name);
    return {
      name: result.name,
      dimension: result.dimension,
      metric: result.metric,
      vectorCount: result.vector_count,
    };
  }

  async list(): Promise<NamespaceInfo[]> {
    const result = await this.client.listNamespaces();
    return (result.namespaces ?? []).map((ns) => ({
      name: ns.name,
      dimension: ns.dimension,
      metric: ns.metric,
      vectorCount: ns.vector_count,
    }));
  }

  async configure(name: string, config: Record<string, unknown>): Promise<void> {
    await this.client.configureNamespace(name, config);
  }

  async delete(name: string): Promise<void> {
    await this.client.deleteNamespace(name);
  }

  async stats(name: string): Promise<unknown> {
    return this.client.getIndexStats(name);
  }
}

/**
 * DakeraNamespaceManager — namespace CRUD operations via Dakera.
 *
 * @example
 * ```typescript
 * import { DakeraNamespaceManager } from "@dakera-ai/langchain";
 *
 * const ns = new DakeraNamespaceManager({
 *   apiUrl: "http://localhost:3300",
 *   apiKey: "dk-...",
 * });
 *
 * await ns.create("my-namespace", { dimensions: 384, distance: "cosine" });
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

  /**
   * Create a namespace (`PUT /v1/namespaces/{name}`). The server requires
   * `dimensions`; `distance` defaults to cosine.
   */
  async create(
    name: string,
    options?: {
      dimensions?: number;
      distance?: "cosine" | "euclidean" | "dot_product";
      /** @deprecated Not a server field; never sent (checked against the server's capabilities). */
      indexType?: string;
      /** @deprecated Not a server field; never sent. */
      metadata?: Record<string, unknown>;
    },
  ): Promise<unknown> {
    return this.client.createNamespace(name, {
      ...(options?.dimensions !== undefined ? { dimensions: options.dimensions } : {}),
      ...(options?.distance !== undefined ? { distance: options.distance } : {}),
      ...(options?.indexType !== undefined ? { indexType: options.indexType } : {}),
    });
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

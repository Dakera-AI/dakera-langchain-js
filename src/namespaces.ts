/**
 * DakeraNamespaceManager — namespace CRUD operations via Dakera.
 *
 * @example
 * ```typescript
 * import { DakeraNamespaceManager } from "@dakera-ai/langchain";
 *
 * const ns = new DakeraNamespaceManager({
 *   apiUrl: "http://localhost:3000",
 *   apiKey: "dk-...",
 * });
 *
 * await ns.create("my-namespace", { dimensions: 384, distance: "cosine" });
 * const all = await ns.list();
 * ```
 */

import { DakeraClient } from "@dakera-ai/dakera";

/** Options for {@link DakeraNamespaceManager}. */
export interface DakeraNamespaceManagerOptions {
  /** Dakera server URL, e.g. `http://localhost:3000`. */
  apiUrl: string;
  /** Dakera API key; omit for a server running without auth. */
  apiKey?: string;
}

/** A vector namespace. */
export interface NamespaceInfo {
  /** Namespace name. */
  name: string;
  /** Vector dimension (from {@link DakeraNamespaceManager.get}; not part of a listing). */
  dimension: number | undefined;
  /** Number of vectors stored (from {@link DakeraNamespaceManager.get}; not part of a listing). */
  vectorCount: number | undefined;
  /**
   * `"data"` for vector namespaces, `"agent"` for an agent's memory namespace
   * (`_dakera_agent_<id>`), `"system"` for the server's own (server v0.12.2+).
   */
  kind: string | undefined;
}

/** Create, inspect and delete vector namespaces (the collections {@link DakeraVectorStore} reads and writes). */
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

  /** Read one namespace. */
  async get(name: string): Promise<NamespaceInfo> {
    const result = await this.client.getNamespace(name);
    return {
      name: result.namespace,
      dimension: result.dimension,
      vectorCount: result.vector_count,
      kind: result.kind,
    };
  }

  /**
   * List the namespaces the API key can read, with their `kind`. The server's
   * listing carries names only: `dimension` and `vectorCount` are `undefined`
   * here, {@link get} reads them.
   */
  async list(): Promise<NamespaceInfo[]> {
    const result = await this.client.listNamespaces();
    return result.map((ns) => ({
      name: ns.namespace,
      dimension: undefined,
      vectorCount: undefined,
      kind: ns.kind,
    }));
  }

  /** Set a namespace's vector dimension and distance metric. */
  async configure(name: string, config: { dimension: number; distance?: string }): Promise<void> {
    await this.client.configureNamespace(name, {
      dimension: config.dimension,
      ...(config.distance !== undefined
        ? { distance: config.distance as "cosine" | "euclidean" | "dot_product" }
        : {}),
    });
  }

  /** Delete a namespace and everything in it. */
  async delete(name: string): Promise<void> {
    await this.client.deleteNamespace(name);
  }

  /** Index statistics of a namespace, as the server returns them. */
  async stats(name: string): Promise<unknown> {
    return this.client.getIndexStats(name);
  }
}

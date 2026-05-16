/**
 * DakeraVectorStore — LangChain.js vector store using Dakera server-side embedding.
 *
 * @example
 * ```typescript
 * import { DakeraVectorStore } from "@dakera-ai/langchain";
 *
 * const vectorstore = new DakeraVectorStore({
 *   apiUrl: "https://api.dakera.ai",
 *   apiKey: "dk-...",
 *   namespace: "docs",
 * });
 * await vectorstore.addDocuments([{ pageContent: "Hello world", metadata: {} }]);
 * const results = await vectorstore.similaritySearch("hello", 4);
 * ```
 */

import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { DakeraClient } from "@dakera-ai/dakera";

export interface DakeraVectorStoreOptions {
  /** Dakera API base URL */
  apiUrl: string;
  /** Dakera API key */
  apiKey?: string;
  /** Vector namespace to read/write */
  namespace: string;
  /**
   * Optional server-side embedding model override (e.g. `"minilm"`, `"bge-small"`).
   * Defaults to the namespace's configured model.
   */
  embeddingModel?: string;
  /**
   * Embeddings instance.  Accepted for LangChain interface compatibility but
   * unused — Dakera performs server-side embedding.
   */
  embeddings?: EmbeddingsInterface;
}

/**
 * LangChain.js vector store backed by Dakera AI.
 *
 * Uses Dakera's server-side embedding — no local embedding model required.
 * All text is embedded on the Dakera server using the configured model
 * (default: MiniLM).
 */
export class DakeraVectorStore extends VectorStore {
  private readonly dakeraClient: DakeraClient;
  private readonly namespace: string;

  declare FilterType: Record<string, unknown>;

  constructor(options: DakeraVectorStoreOptions) {
    // Pass a stub embeddings object to satisfy the VectorStore ABC.
    // Dakera uses server-side embedding so the embeddings object is never called.
    super(options.embeddings ?? ({ embedQuery: async () => [] } as unknown as EmbeddingsInterface), {});
    const clientOpts: import("@dakera-ai/dakera").ClientOptions = {
      baseUrl: options.apiUrl,
      ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
    };
    this.dakeraClient = new DakeraClient(clientOpts);
    this.namespace = options.namespace;
  }

  _vectorstoreType(): string {
    return "dakera";
  }

  /**
   * Upsert texts into Dakera using server-side embedding.
   *
   * Returns the document IDs that were upserted.
   */
  async addVectors(
    _vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] },
  ): Promise<string[]> {
    // Dakera handles embedding server-side — we ignore pre-computed vectors.
    return this.addDocuments(documents, options);
  }

  /**
   * Upsert documents into Dakera using server-side embedding.
   *
   * Returns the document IDs that were upserted.
   */
  override async addDocuments(
    documents: Document[],
    options?: { ids?: string[] },
  ): Promise<string[]> {
    const ids = options?.ids ?? documents.map(() => crypto.randomUUID());
    const docs = documents.map((doc, i) => ({
      id: ids[i] as string,
      text: doc.pageContent,
      metadata: doc.metadata as Record<string, unknown>,
    }));
    await this.dakeraClient.upsertText(this.namespace, docs);
    return ids;
  }

  /**
   * Search for documents most similar to a pre-computed query vector.
   *
   * Note: Dakera performs server-side embedding via `similaritySearch()`.
   * If you have a raw query vector, prefer `similaritySearch()` with a text query.
   */
  async similaritySearchVectorWithScore(
    _query: number[],
    k: number,
    filter?: this["FilterType"],
  ): Promise<[Document, number][]> {
    // Fall back to text-based search using an empty string — callers should
    // prefer similaritySearch() for text queries.
    return this._textSearchWithScore("", k, filter);
  }

  /**
   * Search for documents similar to the query string.
   *
   * Returns documents with their similarity scores.
   */
  async similaritySearchWithScore(
    query: string,
    k = 4,
    filter?: this["FilterType"],
  ): Promise<[Document, number][]> {
    return this._textSearchWithScore(query, k, filter);
  }

  /**
   * Search for documents similar to the query string.
   */
  override async similaritySearch(
    query: string,
    k = 4,
    filter?: this["FilterType"],
  ): Promise<Document[]> {
    const results = await this._textSearchWithScore(query, k, filter);
    return results.map(([doc]) => doc);
  }

  /**
   * Combined vector + BM25 hybrid search with configurable alpha weighting.
   */
  async hybridSearch(
    query: string,
    k = 4,
    options?: { filter?: this["FilterType"]; alpha?: number },
  ): Promise<Document[]> {
    const response = await this.dakeraClient.hybridSearch(this.namespace, query, {
      topK: k,
      ...(options?.filter !== undefined ? { filter: options.filter as import("@dakera-ai/dakera").FilterExpression } : {}),
      alpha: options?.alpha ?? 0.5,
    });
    return response.results.map((r) =>
      new Document({
        pageContent: r.text ?? "",
        metadata: { ...(r.metadata ?? {}), score: r.score, id: r.id },
      }),
    );
  }

  /**
   * BM25-only fulltext search.
   */
  async fulltextSearch(query: string, k = 10, filter?: this["FilterType"]): Promise<Document[]> {
    const response = await this.dakeraClient.fulltextSearch(this.namespace, query, {
      topK: k,
      ...(filter !== undefined ? { filter: filter as import("@dakera-ai/dakera").FilterExpression } : {}),
    });
    return response.results.map((r) =>
      new Document({
        pageContent: r.text ?? "",
        metadata: { ...(r.metadata ?? {}), score: r.score, id: r.id },
      }),
    );
  }

  private async _textSearchWithScore(
    query: string,
    k: number,
    filter?: Record<string, unknown>,
  ): Promise<[Document, number][]> {
    const response = await this.dakeraClient.queryText(this.namespace, query, {
      topK: k,
      ...(filter !== undefined ? { filter: filter as import("@dakera-ai/dakera").FilterExpression } : {}),
      includeText: true,
    });
    return response.results.map((r) => [
      new Document({
        pageContent: r.text ?? "",
        metadata: { ...(r.metadata ?? {}), score: r.score, id: r.id },
      }),
      r.score,
    ]);
  }

  /**
   * Create a DakeraVectorStore and upsert documents in one call.
   *
   * The `embeddings` argument is accepted for LangChain interface
   * compatibility but is unused — Dakera performs server-side embedding.
   */
  static override async fromDocuments(
    docs: Document[],
    _embeddings: EmbeddingsInterface,
    dbConfig: DakeraVectorStoreOptions,
  ): Promise<DakeraVectorStore> {
    const store = new DakeraVectorStore(dbConfig);
    await store.addDocuments(docs);
    return store;
  }

  /**
   * Create a DakeraVectorStore and upsert texts in one call.
   */
  static override async fromTexts(
    texts: string[],
    metadatas: Record<string, unknown>[] | Record<string, unknown>,
    _embeddings: EmbeddingsInterface,
    dbConfig: DakeraVectorStoreOptions,
  ): Promise<DakeraVectorStore> {
    const metaArray = Array.isArray(metadatas)
      ? metadatas
      : texts.map(() => metadatas as Record<string, unknown>);
    const docs = texts.map(
      (t, i) => new Document({ pageContent: t, metadata: metaArray[i] ?? {} }),
    );
    return DakeraVectorStore.fromDocuments(docs, _embeddings, dbConfig);
  }
}

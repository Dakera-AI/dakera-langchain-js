/**
 * DakeraVectorStore — LangChain.js vector store using Dakera server-side embedding.
 *
 * @example
 * ```typescript
 * import { DakeraVectorStore } from "@dakera-ai/langchain";
 *
 * const vectorstore = new DakeraVectorStore({
 *   apiUrl: "http://localhost:3000",
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
import { DakeraClient, type EmbeddingModel, type FilterExpression } from "@dakera-ai/dakera";

/** Options for {@link DakeraVectorStore}. */
export interface DakeraVectorStoreOptions {
  /** Dakera server URL, e.g. `http://localhost:3000`. */
  apiUrl: string;
  /** Dakera API key; omit for a server running without auth. */
  apiKey?: string;
  /** Namespace the documents are written to and searched in (created on first write). */
  namespace: string;
  /**
   * Server-side embedding model for documents and queries (e.g. `"bge-large"`,
   * `"minilm"`); the server's default model when omitted. Use the same model for
   * every write and search of a namespace. The models a server offers are listed
   * by `GET /v1/capabilities`.
   */
  embeddingModel?: EmbeddingModel;
  /**
   * Not needed: Dakera embeds documents and queries on the server. Accepted so
   * the store can be built where LangChain passes an `Embeddings` instance; it is
   * never called.
   */
  embeddings?: EmbeddingsInterface;
}

/**
 * LangChain.js `VectorStore` over a Dakera namespace. Documents and queries are
 * embedded by the server (no embeddings API or local model needed); results
 * carry the server's `id` and `score` in `metadata`.
 */
export class DakeraVectorStore extends VectorStore {
  private readonly dakeraClient: DakeraClient;
  private readonly namespace: string;
  private readonly embeddingModel: EmbeddingModel | undefined;

  declare FilterType: Record<string, unknown>;

  constructor(options: DakeraVectorStoreOptions) {
    super(
      options.embeddings ?? ({ embedQuery: async () => [] } as unknown as EmbeddingsInterface),
      {},
    );
    const clientOpts: import("@dakera-ai/dakera").ClientOptions = {
      baseUrl: options.apiUrl,
      ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
    };
    this.dakeraClient = new DakeraClient(clientOpts);
    this.namespace = options.namespace;
    this.embeddingModel = options.embeddingModel;
  }

  _vectorstoreType(): string {
    return "dakera";
  }

  /**
   * LangChain's vector entry point. The vectors are ignored: the documents are
   * stored with {@link addDocuments} and embedded by the server.
   */
  async addVectors(
    _vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] },
  ): Promise<string[]> {
    return this.addDocuments(documents, options);
  }

  /**
   * Store documents (embedded by the server). Returns their ids: `options.ids`
   * when given (an existing id is overwritten), else new random UUIDs.
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
    await this.dakeraClient.upsertText(
      this.namespace,
      docs,
      this.embeddingModel !== undefined ? { model: this.embeddingModel } : {},
    );
    return ids;
  }

  /**
   * LangChain's vector search entry point. A query vector cannot be searched
   * without its text, so this runs {@link similaritySearchWithScore} with an
   * empty query; call that (or `similaritySearch`) with the query text instead.
   */
  async similaritySearchVectorWithScore(
    _query: number[],
    k: number,
    filter?: Record<string, unknown>,
  ): Promise<[Document, number][]> {
    return this._textSearchWithScore("", k, filter);
  }

  /** Semantic search: the `k` most similar documents with their similarity scores. */
  async similaritySearchWithScore(
    query: string,
    k = 4,
    filter?: Record<string, unknown>,
  ): Promise<[Document, number][]> {
    return this._textSearchWithScore(query, k, filter);
  }

  /** Semantic search: the `k` most similar documents. */
  override async similaritySearch(
    query: string,
    k = 4,
    filter?: Record<string, unknown>,
  ): Promise<Document[]> {
    const results = await this._textSearchWithScore(query, k, filter);
    return results.map(([doc]) => doc);
  }

  /**
   * Hybrid search over the namespace (`POST /v1/namespaces/{ns}/hybrid`).
   *
   * The server blends vector similarity and BM25 only when the request carries a
   * query vector; this method sends the text alone, so the ranking is BM25 and
   * `alpha` (the vector weight) has no effect. The server returns ids and scores
   * but not the stored text, so each document's `pageContent` is empty and
   * `metadata` holds `id` and `score`.
   */
  async hybridSearch(
    query: string,
    k = 4,
    options?: { filter?: Record<string, unknown>; alpha?: number },
  ): Promise<Document[]> {
    const response = await this.dakeraClient.hybridSearch(this.namespace, query, {
      topK: k,
      ...(options?.filter !== undefined ? { filter: options.filter as FilterExpression } : {}),
      vectorWeight: options?.alpha ?? 0.5,
    });
    return response.map((r) =>
      new Document({
        pageContent: "",
        metadata: { ...(r.metadata ?? {}), score: r.score, id: r.id },
      }),
    );
  }

  /**
   * BM25 full-text search over the namespace. The server returns ids and scores
   * but not the stored text, so each document's `pageContent` is empty and
   * `metadata` holds `id` and `score`.
   */
  async fulltextSearch(
    query: string,
    k = 10,
    filter?: Record<string, unknown>,
  ): Promise<Document[]> {
    const response = await this.dakeraClient.fulltextSearch(this.namespace, query, {
      topK: k,
      ...(filter !== undefined ? { filter: filter as FilterExpression } : {}),
    });
    return response.map((r) =>
      new Document({
        pageContent: "",
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
      ...(filter !== undefined ? { filter: filter as FilterExpression } : {}),
      includeText: true,
      ...(this.embeddingModel !== undefined ? { model: this.embeddingModel } : {}),
    });
    return response.results.map((r) => [
      new Document({
        pageContent: r.text ?? "",
        metadata: { ...(r.metadata ?? {}), score: r.score, id: r.id },
      }),
      r.score,
    ]);
  }

  /** Create a store for `dbConfig.namespace` and add `docs` to it (`_embeddings` is not used). */
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
   * Create a store for `dbConfig.namespace` and add `texts`, with `metadatas`
   * per text or one object for all (`_embeddings` is not used).
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

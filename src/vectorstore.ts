/**
 * DakeraVectorStore — LangChain.js vector store using Dakera server-side embedding.
 *
 * @example
 * ```typescript
 * import { DakeraVectorStore } from "@dakera-ai/langchain";
 *
 * const vectorstore = new DakeraVectorStore({
 *   apiUrl: "http://localhost:3300",
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
import { DakeraClient, type FilterExpression } from "@dakera-ai/dakera";

export interface DakeraVectorStoreOptions {
  apiUrl: string;
  apiKey?: string;
  namespace: string;
  embeddingModel?: string;
  embeddings?: EmbeddingsInterface;
}

export class DakeraVectorStore extends VectorStore {
  private readonly dakeraClient: DakeraClient;
  private readonly namespace: string;

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
  }

  _vectorstoreType(): string {
    return "dakera";
  }

  async addVectors(
    _vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] },
  ): Promise<string[]> {
    return this.addDocuments(documents, options);
  }

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

  async similaritySearchVectorWithScore(
    _query: number[],
    k: number,
    filter?: Record<string, unknown>,
  ): Promise<[Document, number][]> {
    return this._textSearchWithScore("", k, filter);
  }

  async similaritySearchWithScore(
    query: string,
    k = 4,
    filter?: Record<string, unknown>,
  ): Promise<[Document, number][]> {
    return this._textSearchWithScore(query, k, filter);
  }

  override async similaritySearch(
    query: string,
    k = 4,
    filter?: Record<string, unknown>,
  ): Promise<Document[]> {
    const results = await this._textSearchWithScore(query, k, filter);
    return results.map(([doc]) => doc);
  }

  async hybridSearch(
    query: string,
    k = 4,
    options?: { filter?: Record<string, unknown>; alpha?: number },
  ): Promise<Document[]> {
    const response = await this.dakeraClient.hybridSearch(this.namespace, query, {
      topK: k,
      ...(options?.filter !== undefined ? { filter: options.filter as FilterExpression } : {}),
      alpha: options?.alpha ?? 0.5,
    });
    return response.map((r) =>
      new Document({
        pageContent: "",
        metadata: { ...(r.metadata ?? {}), score: r.score, id: r.id },
      }),
    );
  }

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
    });
    return response.results.map((r) => [
      new Document({
        pageContent: r.text ?? "",
        metadata: { ...(r.metadata ?? {}), score: r.score, id: r.id },
      }),
      r.score,
    ]);
  }

  static override async fromDocuments(
    docs: Document[],
    _embeddings: EmbeddingsInterface,
    dbConfig: DakeraVectorStoreOptions,
  ): Promise<DakeraVectorStore> {
    const store = new DakeraVectorStore(dbConfig);
    await store.addDocuments(docs);
    return store;
  }

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

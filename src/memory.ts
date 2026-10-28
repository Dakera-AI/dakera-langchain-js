/**
 * DakeraMemory — LangChain.js memory backed by the Dakera AI memory platform.
 *
 * @example
 * ```typescript
 * import { DakeraMemory } from "@dakera-ai/langchain";
 * import { ChatPromptTemplate } from "@langchain/core/prompts";
 * import { StringOutputParser } from "@langchain/core/output_parsers";
 * import { ChatOpenAI } from "@langchain/openai";
 *
 * const memory = new DakeraMemory({
 *   apiUrl: "http://localhost:3000",
 *   apiKey: "dk-...",
 *   agentId: "my-agent",
 * });
 * const prompt = ChatPromptTemplate.fromMessages([
 *   ["system", "Relevant memories:\n{history}"],
 *   ["human", "{input}"],
 * ]);
 * const chain = prompt.pipe(new ChatOpenAI({ model: "gpt-4o-mini" })).pipe(new StringOutputParser());
 *
 * const input = "Hello, who are you?";
 * const { history } = await memory.loadMemoryVariables({ input });
 * const output = await chain.invoke({ history, input });
 * await memory.saveContext({ input }, { output });
 * ```
 */

import type { InputValues, MemoryVariables, OutputValues } from "@langchain/core/memory";
import { BaseMemory } from "@langchain/core/memory";
import { DakeraClient, ErrorCode, NotFoundError, type MemoryRecallOptions } from "@dakera-ai/dakera";

/** Options for {@link DakeraMemory}. */
export interface DakeraMemoryOptions {
  /** Dakera server URL, e.g. `http://localhost:3000`. */
  apiUrl: string;
  /** Dakera API key; omit for a server running without auth. */
  apiKey?: string;
  /** Agent whose memories are stored and recalled (one agent per user or assistant). */
  agentId: string;
  /** Maximum number of memories recalled per turn (default: 5). */
  recallK?: number;
  /** Minimum importance score for recalled memories (default: 0) */
  minImportance?: number;
  /** Key used to inject recalled memories into the prompt (default: "history") */
  memoryKey?: string;
  /** Input key to use as the recall query. Defaults to the first input key. */
  inputKey?: string;
  /** Importance score assigned when storing new memories (default: 0.7) */
  importance?: number;
  /**
   * Session the stored turns belong to, e.g. the id returned by
   * `DakeraSessionManager.start()`. Recall still searches all of the agent's
   * memories.
   */
  sessionId?: string;
}

/**
 * LangChain.js memory that stores and recalls conversation turns via Dakera.
 *
 * Each turn is stored as one memory of the agent; at the next turn the memories
 * most relevant to the input are recalled (semantic search, weighted by
 * importance and recency) and injected under `memoryKey`. Memories persist
 * across processes and restarts.
 */
export class DakeraMemory extends BaseMemory {
  private readonly client: DakeraClient;
  private readonly agentId: string;
  private readonly recallK: number;
  private readonly minImportance: number;
  readonly memoryKey: string;
  private readonly inputKey: string | undefined;
  private readonly importance: number;
  private readonly sessionId: string | undefined;

  constructor(options: DakeraMemoryOptions) {
    super();
    const clientOpts: import("@dakera-ai/dakera").ClientOptions = {
      baseUrl: options.apiUrl,
      ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
    };
    this.client = new DakeraClient(clientOpts);
    this.agentId = options.agentId;
    this.recallK = options.recallK ?? 5;
    this.minImportance = options.minImportance ?? 0;
    this.memoryKey = options.memoryKey ?? "history";
    this.inputKey = options.inputKey;
    this.importance = options.importance ?? 0.7;
    this.sessionId = options.sessionId;
  }

  /** The prompt variables this memory fills: `[memoryKey]`. */
  get memoryKeys(): string[] {
    return [this.memoryKey];
  }

  /** Same as {@link memoryKeys}. */
  get memoryVariables(): string[] {
    return [this.memoryKey];
  }

  private getQuery(inputs: InputValues): string {
    if (this.inputKey !== undefined) {
      return String(inputs[this.inputKey] ?? "");
    }
    const firstValue = Object.values(inputs)[0];
    return String(firstValue ?? "");
  }

  /**
   * Recall semantically relevant memories for the current input.
   *
   * Returns an object with `memoryKey` mapped to a newline-joined string
   * of at most `recallK` recalled memory contents, best first (`""` for an
   * agent that has stored nothing yet).
   */
  async loadMemoryVariables(inputs: InputValues): Promise<MemoryVariables> {
    const query = this.getQuery(inputs);
    if (!query) {
      return { [this.memoryKey]: "" };
    }

    // A server's default `neighborhood_mode: "inline"` appends session-adjacent
    // context after the `top_k` ranked results; "separate" keeps it out of
    // `memories`. Servers before v0.12.3 ignore the mode and append it inline
    // (`retrieval: "neighborhood"`), so those items are dropped and the list is
    // cut at `recallK` either way.
    const recallOpts: MemoryRecallOptions = {
      top_k: this.recallK,
      neighborhood_mode: "separate",
    };
    if (this.minImportance > 0) {
      recallOpts.min_importance = this.minImportance;
    }
    let response;
    try {
      response = await this.client.recall(this.agentId, query, recallOpts);
    } catch (err) {
      // Servers before v0.12.3 answer 404 NAMESPACE_NOT_FOUND for an agent that
      // has stored nothing yet (a v0.12.3 server answers no memories).
      if (err instanceof NotFoundError && err.code === ErrorCode.NAMESPACE_NOT_FOUND) {
        return { [this.memoryKey]: "" };
      }
      throw err;
    }

    const history = (response.memories ?? [])
      .filter((m) => m.retrieval !== "neighborhood")
      .slice(0, this.recallK)
      .map((m) => m.content)
      .join("\n");

    return { [this.memoryKey]: history };
  }

  /**
   * Persist a conversation turn as one episodic memory (`Human: …\nAI: …`),
   * from the first value of `inputs` and of `outputs`.
   */
  async saveContext(inputs: InputValues, outputs: OutputValues): Promise<void> {
    const human = String(Object.values(inputs)[0] ?? "");
    const ai = String(Object.values(outputs)[0] ?? "");
    const content = `Human: ${human}\nAI: ${ai}`;

    await this.client.storeMemory(this.agentId, {
      content,
      memory_type: "episodic",
      importance: this.importance,
      ...(this.sessionId !== undefined ? { session_id: this.sessionId } : {}),
    });
  }

  /**
   * No-op: Dakera memories are persistent by design. Delete memories with the
   * `@dakera-ai/dakera` client when they must go.
   */
  async clear(): Promise<void> {
    // intentional no-op
  }
}

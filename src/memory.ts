/**
 * DakeraMemory — LangChain.js memory backed by the Dakera AI memory platform.
 *
 * @example
 * ```typescript
 * import { DakeraMemory } from "@dakera-ai/langchain";
 * import { ConversationChain } from "langchain/chains";
 * import { ChatOpenAI } from "@langchain/openai";
 *
 * const memory = new DakeraMemory({
 *   apiUrl: "https://api.dakera.ai",
 *   apiKey: "dk-...",
 *   agentId: "my-agent",
 * });
 * const chain = new ConversationChain({ llm: new ChatOpenAI(), memory });
 * await chain.call({ input: "Hello, who are you?" });
 * ```
 */

import type { InputValues, MemoryVariables, OutputValues } from "@langchain/core/memory";
import { BaseMemory } from "@langchain/core/memory";
import { DakeraClient } from "@dakera-ai/dakera";

export interface DakeraMemoryOptions {
  /** Dakera API base URL */
  apiUrl: string;
  /** Dakera API key */
  apiKey?: string;
  /** Agent identifier for memory storage */
  agentId: string;
  /** Number of memories to recall per turn (default: 5) */
  recallK?: number;
  /** Minimum importance score for recalled memories (default: 0) */
  minImportance?: number;
  /** Key used to inject recalled memories into the prompt (default: "history") */
  memoryKey?: string;
  /** Input key to use as the recall query. Defaults to the first input key. */
  inputKey?: string;
  /** Importance score assigned when storing new memories (default: 0.7) */
  importance?: number;
}

/**
 * LangChain.js memory that stores and recalls conversation turns via Dakera.
 *
 * Memories are stored persistently on the Dakera platform and recalled
 * using semantic search at each conversation turn.
 */
export class DakeraMemory extends BaseMemory {
  private readonly client: DakeraClient;
  private readonly agentId: string;
  private readonly recallK: number;
  private readonly minImportance: number;
  readonly memoryKey: string;
  private readonly inputKey: string | undefined;
  private readonly importance: number;

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
  }

  get memoryKeys(): string[] {
    return [this.memoryKey];
  }

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
   * of recalled memory contents.
   */
  async loadMemoryVariables(inputs: InputValues): Promise<MemoryVariables> {
    const query = this.getQuery(inputs);
    if (!query) {
      return { [this.memoryKey]: "" };
    }

    const recallOpts: { top_k?: number; min_importance?: number } = {
      top_k: this.recallK,
    };
    if (this.minImportance > 0) {
      recallOpts.min_importance = this.minImportance;
    }
    const memories = await this.client.recall(this.agentId, query, recallOpts);

    const history = memories
      .map((m) => (typeof m === "object" && "content" in m ? m.content : String(m)))
      .join("\n");

    return { [this.memoryKey]: history };
  }

  /**
   * Persist a conversation turn as a new memory.
   */
  async saveContext(inputs: InputValues, outputs: OutputValues): Promise<void> {
    const human = String(Object.values(inputs)[0] ?? "");
    const ai = String(Object.values(outputs)[0] ?? "");
    const content = `Human: ${human}\nAI: ${ai}`;

    await this.client.storeMemory(this.agentId, {
      content,
      memory_type: "episodic",
      importance: this.importance,
    });
  }

  /**
   * No-op: Dakera memories are persistent by design.
   */
  async clear(): Promise<void> {
    // intentional no-op
  }
}

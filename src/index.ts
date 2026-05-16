/**
 * @dakera-ai/langchain — LangChain.js integration for Dakera AI memory platform.
 *
 * @example
 * ```typescript
 * import {
 *   DakeraMemory,
 *   DakeraVectorStore,
 *   DakeraSessionManager,
 *   DakeraKnowledgeGraph,
 * } from "@dakera-ai/langchain";
 * ```
 *
 * @packageDocumentation
 */

export { DakeraMemory } from "./memory.js";
export type { DakeraMemoryOptions } from "./memory.js";

export { DakeraVectorStore } from "./vectorstore.js";
export type { DakeraVectorStoreOptions } from "./vectorstore.js";

export { DakeraSessionManager } from "./sessions.js";
export type { DakeraSessionManagerOptions, SessionInfo, SessionMemory } from "./sessions.js";

export { DakeraKnowledgeGraph } from "./knowledge-graph.js";
export type { DakeraKnowledgeGraphOptions, GraphResult } from "./knowledge-graph.js";

export { DakeraEntityExtractor } from "./entities.js";
export type { DakeraEntityExtractorOptions, Entity } from "./entities.js";

export { DakeraNamespaceManager } from "./namespaces.js";
export type { DakeraNamespaceManagerOptions, NamespaceInfo } from "./namespaces.js";

export { DakeraAgentTools } from "./agents.js";
export type { DakeraAgentToolsOptions, AgentMemory } from "./agents.js";

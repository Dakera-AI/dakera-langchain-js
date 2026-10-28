/**
 * DakeraMemory in an LCEL chat chain.
 *
 * Before each call the chain's `{history}` is filled with the memories most
 * relevant to the input; after it, the turn is stored. The chat model here is
 * LangChain's `FakeListChatModel`, so the example runs without an API key —
 * swap in any chat model, e.g.:
 *
 *   import { ChatOpenAI } from "@langchain/openai";
 *   const model = new ChatOpenAI({ model: "gpt-4o-mini" });
 *
 * Run from the repository root, with a Dakera server running:
 *   npm install && npm run build
 *   DAKERA_API_URL=http://localhost:3000 DAKERA_API_KEY=dk-mykey npx tsx examples/chat_chain.ts
 */

import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { DakeraMemory } from "@dakera-ai/langchain";

const apiUrl = process.env.DAKERA_API_URL ?? "http://localhost:3000";
const apiKey = process.env.DAKERA_API_KEY;

const memory = new DakeraMemory({
  apiUrl,
  ...(apiKey ? { apiKey } : {}),
  agentId: "langchain-js-chat-demo",
  recallK: 4,
});

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant. What you remember about the user:\n{history}"],
  ["human", "{input}"],
]);

const model = new FakeListChatModel({
  responses: [
    "Nice to meet you, Sam! A Rust vector database sounds great.",
    "You're building Velox, a vector database written in Rust.",
  ],
});

const chain = prompt.pipe(model).pipe(new StringOutputParser());

/** One conversation turn: recall, generate, store. */
async function chat(input: string): Promise<string> {
  const { history } = await memory.loadMemoryVariables({ input });
  const output = await chain.invoke({ history, input });
  await memory.saveContext({ input }, { output });
  return output;
}

async function main() {
  console.log("> I'm Sam and I'm building Velox, a vector database in Rust.");
  console.log(await chat("I'm Sam and I'm building Velox, a vector database in Rust."));

  // A later turn — or a later process: the memory lives on the Dakera server.
  console.log("\n> What am I building?");
  const { history } = await memory.loadMemoryVariables({ input: "What am I building?" });
  console.log(`(recalled into {history}:\n${history})`);
  console.log(await chat("What am I building?"));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

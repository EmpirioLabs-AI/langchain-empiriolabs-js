/**
 * Live checks against the EmpirioLabs AI API. They spend a few cents of credit, so they run only
 * with `npm run test:live` and an EMPIRIOLABS_API_KEY in the environment.
 */
import { AIMessageChunk, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { createAgent } from "langchain";
import { describe, expect, it } from "vitest";
import * as z from "zod";
import { ChatEmpirioLabs, EmpirioLabsEmbeddings } from "../src/index.js";

const CHAT_MODEL = process.env.EMPIRIOLABS_TEST_CHAT_MODEL ?? "qwen3-8-flash";
const EMBEDDING_MODEL = process.env.EMPIRIOLABS_TEST_EMBEDDING_MODEL ?? "text-embedding-v4";
/** A 32 by 32 red square. */
const RED_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGO4IyJHU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULAAQIOD1zd5IxAAAAAElFTkSuQmCC";

const getWeather = tool(async ({ city }) => `It is 21 C and sunny in ${city}.`, {
  name: "get_weather",
  description: "Get the current weather for a city.",
  schema: z.object({ city: z.string().describe("The city name") }),
});

describe.skipIf(!process.env.EMPIRIOLABS_API_KEY)("EmpirioLabs AI API", () => {
  const llm = new ChatEmpirioLabs({ model: CHAT_MODEL });

  it("answers, with reasoning, usage, and the provider", async () => {
    const message = await llm.invoke("What is 17 times 23? Answer with the number only.");
    expect(String(message.content)).toContain("391");
    expect(message.response_metadata.model_provider).toBe("empiriolabs");
    expect(message.usage_metadata?.total_tokens).toBeGreaterThan(0);
    expect(typeof message.additional_kwargs.reasoning_content).toBe("string");
    expect(message.contentBlocks.map((block) => block.type)).toEqual(["reasoning", "text"]);
  });

  it("streams", async () => {
    let full: AIMessageChunk | undefined;
    let chunks = 0;
    for await (const piece of await llm.stream("Count from 1 to 5, separated by spaces.")) {
      chunks += 1;
      full = full ? full.concat(piece) : piece;
    }
    expect(chunks).toBeGreaterThan(2);
    expect(String(full?.content)).toContain("1 2 3 4 5");
    expect(full?.usage_metadata?.total_tokens).toBeGreaterThan(0);
  });

  it("turns thinking off with reasoning_effort none", async () => {
    const quick = new ChatEmpirioLabs({ model: CHAT_MODEL, modelKwargs: { reasoning_effort: "none" } });
    const message = await quick.invoke("Say OK.");
    expect(String(message.content).length).toBeGreaterThan(0);
    expect(message.additional_kwargs.reasoning_content ?? "").toBe("");
  });

  it("calls tools", async () => {
    const message = await llm.bindTools([getWeather]).invoke("What is the weather in Paris?");
    expect(message.tool_calls?.[0]).toMatchObject({ name: "get_weather", args: { city: "Paris" } });
  });

  it("returns structured output with each method", async () => {
    const movie = z.object({ title: z.string(), year: z.number() });
    for (const method of [undefined, "jsonSchema", "functionCalling"] as const) {
      const result = await llm
        .withStructuredOutput(movie, method ? { method } : undefined)
        .invoke("Name one movie directed by Denis Villeneuve.");
      expect(movie.safeParse(result).success, String(method)).toBe(true);
    }
  });

  it("reads images", async () => {
    const message = await llm.invoke([
      new HumanMessage({
        content: [
          { type: "text", text: "What single color fills this image? Answer with one word." },
          { type: "image_url", image_url: { url: `data:image/png;base64,${RED_PNG}` } },
        ],
      }),
    ]);
    expect(String(message.content).toLowerCase()).toContain("red");
  });

  it("runs a createAgent tool loop", async () => {
    const agent = createAgent({ model: llm, tools: [getWeather] });
    const result = await agent.invoke({ messages: [{ role: "user", content: "What is the weather in Tokyo?" }] });
    expect(result.messages.filter((m) => m.type === "tool")).toHaveLength(1);
    expect(String(result.messages.at(-1)?.content)).toMatch(/21/u);
  });

  it("refuses a model ID that does not exist instead of serving another model", async () => {
    const missing = new ChatEmpirioLabs({ model: "no-such-model-empiriolabs-test", maxRetries: 0 });
    await expect(missing.invoke("Hi")).rejects.toThrow();
  });

  it("embeds queries and more documents than one default batch", async () => {
    const embeddings = new EmpirioLabsEmbeddings({ model: EMBEDDING_MODEL });
    const query = await embeddings.embedQuery("What is EmpirioLabs AI?");
    expect(query.length).toBeGreaterThan(0);

    const documents = await embeddings.embedDocuments(Array.from({ length: 600 }, (_, i) => `document number ${i}`));
    expect(documents).toHaveLength(600);
    expect(new Set(documents.map((vector) => vector.length))).toEqual(new Set([query.length]));

    const small = new EmpirioLabsEmbeddings({ model: EMBEDDING_MODEL, dimensions: 256 });
    expect(await small.embedQuery("Hello")).toHaveLength(256);
  });
});

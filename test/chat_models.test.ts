import { AIMessageChunk, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { describe, expect, it, vi } from "vitest";
import * as z from "zod";
import { ChatEmpirioLabs } from "../src/index.js";
import { chatCompletion, chunk, fakeFetch, jsonResponse, sseResponse } from "./helpers.js";

const KEY = "sk-empiriolabs-unit-test-key";

function model(fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>, extra = {}) {
  return new ChatEmpirioLabs({ model: "qwen3-8-flash", apiKey: KEY, maxRetries: 0, configuration: { fetch }, ...extra });
}

describe("ChatEmpirioLabs requests", () => {
  it("calls the EmpirioLabs AI chat completions API with the key and the model", async () => {
    const { fetch, requests } = fakeFetch(jsonResponse(chatCompletion({ content: "Hi" })));
    const message = await model(fetch).invoke("Say hi");

    expect(message.content).toBe("Hi");
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.url).toBe("https://api.empiriolabs.ai/v1/chat/completions");
    expect(request?.method).toBe("POST");
    expect(request?.headers.get("authorization")).toBe(`Bearer ${KEY}`);
    expect(request?.body.model).toBe("qwen3-8-flash");
    expect(request?.body.messages).toEqual([{ role: "user", content: "Say hi" }]);
  });

  it("accepts the model as the first argument", async () => {
    const { fetch, requests } = fakeFetch(jsonResponse(chatCompletion({ content: "Hi" })));
    await new ChatEmpirioLabs("glm-5-1", { apiKey: KEY, configuration: { fetch } }).invoke("Hi");
    expect(requests[0]?.body.model).toBe("glm-5-1");
  });

  it("reads the key from EMPIRIOLABS_API_KEY and never from OPENAI_API_KEY", async () => {
    vi.stubEnv("EMPIRIOLABS_API_KEY", "sk-empiriolabs-from-env");
    vi.stubEnv("OPENAI_API_KEY", "sk-openai-must-not-be-sent");
    const { fetch, requests } = fakeFetch(jsonResponse(chatCompletion({ content: "Hi" })));
    await new ChatEmpirioLabs({ model: "qwen3-8-flash", configuration: { fetch } }).invoke("Hi");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer sk-empiriolabs-from-env");
  });

  it("accepts a function that returns the key", async () => {
    const { fetch, requests } = fakeFetch(jsonResponse(chatCompletion({ content: "Hi" })));
    await model(fetch, { apiKey: async () => "sk-empiriolabs-from-a-function" }).invoke("Hi");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer sk-empiriolabs-from-a-function");
  });

  it("explains how to get a key when none is set, even with OPENAI_API_KEY present", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-openai-must-not-be-used");
    expect(() => new ChatEmpirioLabs({ model: "qwen3-8-flash" })).toThrow(
      /EMPIRIOLABS_API_KEY.*platform\.empiriolabs\.ai\/dashboard\/api-keys/u,
    );
  });

  it("asks for a model ID instead of sending OpenAI's default model", () => {
    expect(() => new ChatEmpirioLabs({ apiKey: KEY })).toThrow(/needs a model ID.*qwen3-8-flash/u);
  });

  it("uses EMPIRIOLABS_API_BASE, and configuration.baseURL over it", async () => {
    vi.stubEnv("EMPIRIOLABS_API_BASE", "https://proxy.example.com/v1");
    vi.stubEnv("OPENAI_BASE_URL", "https://api.openai.com/v1");
    const first = fakeFetch(jsonResponse(chatCompletion({ content: "Hi" })));
    await model(first.fetch).invoke("Hi");
    expect(first.requests[0]?.url).toBe("https://proxy.example.com/v1/chat/completions");

    const second = fakeFetch(jsonResponse(chatCompletion({ content: "Hi" })));
    await model(second.fetch, {
      configuration: { fetch: second.fetch, baseURL: "https://other.example.com/v1" },
    }).invoke("Hi");
    expect(second.requests[0]?.url).toBe("https://other.example.com/v1/chat/completions");
  });

  it("never sends OpenAI organization or project ids from the environment", async () => {
    vi.stubEnv("OPENAI_ORG_ID", "org-must-not-be-sent");
    vi.stubEnv("OPENAI_ORGANIZATION", "org-must-not-be-sent");
    vi.stubEnv("OPENAI_PROJECT_ID", "proj-must-not-be-sent");
    const { fetch, requests } = fakeFetch(jsonResponse(chatCompletion({ content: "Hi" })));
    await model(fetch).invoke("Hi");
    expect(requests[0]?.headers.get("openai-organization")).toBeNull();
    expect(requests[0]?.headers.get("openai-project")).toBeNull();
  });

  it("sends tools in the OpenAI format and parses the tool calls", async () => {
    const getWeather = tool(async ({ city }) => `Sunny in ${city}`, {
      name: "get_weather",
      description: "Get the current weather for a city.",
      schema: z.object({ city: z.string() }),
    });
    const { fetch, requests } = fakeFetch(
      jsonResponse(
        chatCompletion({
          content: null,
          tool_calls: [
            { id: "call_1", type: "function", function: { name: "get_weather", arguments: '{"city":"Paris"}' } },
          ],
        }),
      ),
    );
    const message = await model(fetch).bindTools([getWeather]).invoke("Weather in Paris?");

    const tools = requests[0]?.body.tools as { type: string; function: { name: string } }[];
    expect(tools.map((t) => [t.type, t.function.name])).toEqual([["function", "get_weather"]]);
    expect(message.tool_calls).toEqual([{ id: "call_1", name: "get_weather", args: { city: "Paris" }, type: "tool_call" }]);
  });

  it("asks for structured output with a JSON schema and parses it", async () => {
    const { fetch, requests } = fakeFetch(jsonResponse(chatCompletion({ content: '{"title":"Dune","year":2021}' })));
    const movie = z.object({ title: z.string(), year: z.number() });
    const result = await model(fetch).withStructuredOutput(movie).invoke("A Villeneuve film");

    expect(result).toEqual({ title: "Dune", year: 2021 });
    const format = requests[0]?.body.response_format as { type: string };
    expect(format.type).toBe("json_schema");
  });

  it("sends image input as an image_url content part", async () => {
    const { fetch, requests } = fakeFetch(jsonResponse(chatCompletion({ content: "Red" })));
    await model(fetch).invoke([
      new HumanMessage({
        content: [
          { type: "text", text: "What color is this?" },
          { type: "image_url", image_url: { url: "https://example.com/red.png" } },
        ],
      }),
    ]);
    const [message] = requests[0]?.body.messages as { content: { type: string }[] }[];
    expect(message?.content.map((part) => part.type)).toEqual(["text", "image_url"]);
  });

  it("puts the API's error message in the thrown error", async () => {
    const { fetch } = fakeFetch(
      jsonResponse({ error: { message: "Model not found: no-such-model", type: "invalid_request_error", code: 404 } }, 404),
    );
    await expect(model(fetch, { model: "no-such-model" }).invoke("Hi")).rejects.toThrow(/Model not found: no-such-model/u);
  });
});

describe("ChatEmpirioLabs responses", () => {
  it("returns reasoning, usage, and the provider in the message", async () => {
    const { fetch } = fakeFetch(
      jsonResponse(
        chatCompletion(
          { content: "391", reasoning_content: "17 times 23 is 391." },
          { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50, completion_tokens_details: { reasoning_tokens: 24 } },
        ),
      ),
    );
    const message = await model(fetch).invoke("What is 17*23?");

    expect(message.content).toBe("391");
    expect(message.additional_kwargs.reasoning_content).toBe("17 times 23 is 391.");
    expect(message.response_metadata.model_provider).toBe("empiriolabs");
    expect(message.usage_metadata).toMatchObject({
      input_tokens: 20,
      output_tokens: 30,
      total_tokens: 50,
      output_token_details: { reasoning: 24 },
    });
    expect(message.contentBlocks).toEqual([
      { type: "reasoning", reasoning: "17 times 23 is 391." },
      { type: "text", text: "391" },
    ]);
  });

  it("streams reasoning, text, and tool call chunks", async () => {
    const { fetch, requests } = fakeFetch(
      sseResponse([
        chunk({ role: "assistant", reasoning_content: "Look up " }),
        chunk({ reasoning_content: "the weather." }),
        chunk({ content: "Checking" }),
        chunk({
          tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "get_weather", arguments: '{"ci' } }],
        }),
        chunk({ tool_calls: [{ index: 0, function: { arguments: 'ty":"Oslo"}' } }] }),
        chunk({}, "tool_calls"),
        { ...chunk({}), choices: [], usage: { prompt_tokens: 9, completion_tokens: 7, total_tokens: 16 } },
      ]),
    );
    let full: AIMessageChunk | undefined;
    let pieces = 0;
    for await (const piece of await model(fetch).stream("Weather in Oslo?")) {
      pieces += 1;
      full = full ? full.concat(piece) : piece;
    }

    expect(requests[0]?.body.stream).toBe(true);
    expect(pieces).toBeGreaterThan(3);
    expect(full?.content).toBe("Checking");
    expect(full?.additional_kwargs.reasoning_content).toBe("Look up the weather.");
    expect(full?.tool_calls).toEqual([{ id: "call_1", name: "get_weather", args: { city: "Oslo" }, type: "tool_call" }]);
    expect(full?.response_metadata.model_provider).toBe("empiriolabs");
    expect(full?.usage_metadata).toMatchObject({ input_tokens: 9, output_tokens: 7, total_tokens: 16 });
  });
});

describe("ChatEmpirioLabs identity", () => {
  it("names itself and EmpirioLabs AI in traces", () => {
    const llm = new ChatEmpirioLabs({ model: "qwen3-8-flash", apiKey: KEY, temperature: 0.2 });
    expect(ChatEmpirioLabs.lc_name()).toBe("ChatEmpirioLabs");
    expect(llm._llmType()).toBe("empiriolabs");
    expect(llm.getLsParams({} as never)).toMatchObject({
      ls_provider: "empiriolabs",
      ls_model_name: "qwen3-8-flash",
      ls_model_type: "chat",
      ls_temperature: 0.2,
    });
    expect(llm.metadata?.versions).toMatchObject({ "@empiriolabs/langchain": expect.any(String) });
  });

  it("serializes the key as a secret reference, never its value", () => {
    vi.stubEnv("EMPIRIOLABS_API_KEY", KEY);
    const instances = [
      new ChatEmpirioLabs({ model: "qwen3-8-flash", apiKey: KEY }),
      new ChatEmpirioLabs({ model: "qwen3-8-flash", configuration: { apiKey: KEY } }),
      new ChatEmpirioLabs({ model: "qwen3-8-flash" }),
    ];
    for (const instance of instances) {
      const serialized = instance.toJSON() as { kwargs: Record<string, unknown> };
      expect(JSON.stringify(serialized)).not.toContain(KEY);
      expect(Object.values(serialized.kwargs)).toContainEqual(expect.objectContaining({ lc: 1, type: "secret" }));
      expect(serialized.kwargs.configuration).toEqual({
        organization: null,
        project: null,
        baseURL: "https://api.empiriolabs.ai/v1",
      });
    }
  });
});

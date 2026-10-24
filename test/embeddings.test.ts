import { describe, expect, it, vi } from "vitest";
import { DEFAULT_EMBEDDINGS_BATCH_SIZE, EmpirioLabsEmbeddings } from "../src/index.js";
import { embeddingsResponse, fakeFetch, jsonResponse } from "./helpers.js";

const KEY = "sk-empiriolabs-unit-test-key";

describe("EmpirioLabsEmbeddings", () => {
  it("calls the EmpirioLabs AI embeddings API with the key and the model", async () => {
    const { fetch, requests } = fakeFetch(jsonResponse(embeddingsResponse(1)));
    const embeddings = new EmpirioLabsEmbeddings({ model: "text-embedding-v4", apiKey: KEY, configuration: { fetch } });
    const vector = await embeddings.embedQuery("Hello");

    expect(vector).toHaveLength(4);
    expect(requests[0]?.url).toBe("https://api.empiriolabs.ai/v1/embeddings");
    expect(requests[0]?.headers.get("authorization")).toBe(`Bearer ${KEY}`);
    expect(requests[0]?.body).toMatchObject({ model: "text-embedding-v4", input: "Hello" });
  });

  it("sends at most 10 inputs per request by default, and keeps the order", async () => {
    const { fetch, requests } = fakeFetch([
      jsonResponse(embeddingsResponse(10)),
      jsonResponse(embeddingsResponse(10)),
      jsonResponse(embeddingsResponse(5)),
    ]);
    const embeddings = new EmpirioLabsEmbeddings({
      model: "text-embedding-v4",
      apiKey: KEY,
      maxConcurrency: 1,
      configuration: { fetch },
    });
    const texts = Array.from({ length: 25 }, (_, i) => `document ${i}`);
    const vectors = await embeddings.embedDocuments(texts);

    expect(DEFAULT_EMBEDDINGS_BATCH_SIZE).toBe(10);
    expect(requests.map((r) => (r.body.input as string[]).length)).toEqual([10, 10, 5]);
    expect(requests.flatMap((r) => r.body.input as string[])).toEqual(texts);
    expect(vectors).toHaveLength(25);
  });

  it("passes dimensions and a larger batch size through", async () => {
    const { fetch, requests } = fakeFetch(jsonResponse(embeddingsResponse(12, 256)));
    const embeddings = new EmpirioLabsEmbeddings({
      model: "skylark-embedding-vision",
      apiKey: KEY,
      dimensions: 256,
      batchSize: 16,
      configuration: { fetch },
    });
    await embeddings.embedDocuments(Array.from({ length: 12 }, (_, i) => `text ${i}`));
    expect(requests).toHaveLength(1);
    expect(requests[0]?.body).toMatchObject({ model: "skylark-embedding-vision", dimensions: 256 });
  });

  it("reads EMPIRIOLABS_API_KEY and EMPIRIOLABS_API_BASE, never the OpenAI variables", async () => {
    vi.stubEnv("EMPIRIOLABS_API_KEY", "sk-empiriolabs-from-env");
    vi.stubEnv("EMPIRIOLABS_API_BASE", "https://proxy.example.com/v1");
    vi.stubEnv("OPENAI_API_KEY", "sk-openai-must-not-be-sent");
    vi.stubEnv("OPENAI_ORG_ID", "org-must-not-be-sent");
    const { fetch, requests } = fakeFetch(jsonResponse(embeddingsResponse(1)));
    await new EmpirioLabsEmbeddings({ model: "text-embedding-v4", configuration: { fetch } }).embedQuery("Hi");

    expect(requests[0]?.url).toBe("https://proxy.example.com/v1/embeddings");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer sk-empiriolabs-from-env");
    expect(requests[0]?.headers.get("openai-organization")).toBeNull();
  });

  it("explains a missing key or model", () => {
    expect(() => new EmpirioLabsEmbeddings({ model: "text-embedding-v4" })).toThrow(/EMPIRIOLABS_API_KEY/u);
    expect(() => new EmpirioLabsEmbeddings({ apiKey: KEY })).toThrow(/needs a model ID.*text-embedding-v4/u);
  });
});

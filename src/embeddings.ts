import { OpenAIEmbeddings, type ClientOptions, type OpenAIEmbeddingsParams } from "@langchain/openai";
import { clientOptions, resolveApiKey, resolveModel } from "./client.js";
import { DEFAULT_EMBEDDINGS_BATCH_SIZE } from "./constants.js";

export interface EmpirioLabsEmbeddingsInput extends Partial<OpenAIEmbeddingsParams> {
  /**
   * EmpirioLabs AI API key. Defaults to the `EMPIRIOLABS_API_KEY` environment variable.
   * Create one at https://platform.empiriolabs.ai/dashboard/api-keys.
   */
  apiKey?: ClientOptions["apiKey"];
  /** Embedding model ID from the EmpirioLabs AI catalog, for example `text-embedding-v4`. */
  model?: string;
  /** Inputs per request. Defaults to 10, the most text-embedding-v4 accepts. */
  batchSize?: number;
  /** Options for the OpenAI-compatible client, such as `baseURL`, `timeout`, or `fetch`. */
  configuration?: ClientOptions;
}

/**
 * EmpirioLabs AI embeddings for LangChain.js.
 *
 * @example
 * ```typescript
 * import { EmpirioLabsEmbeddings } from "@empiriolabs/langchain";
 *
 * const embeddings = new EmpirioLabsEmbeddings({ model: "text-embedding-v4" });
 * const vector = await embeddings.embedQuery("What is EmpirioLabs AI?");
 * ```
 */
export class EmpirioLabsEmbeddings extends OpenAIEmbeddings {
  constructor(fields?: EmpirioLabsEmbeddingsInput) {
    const apiKey = resolveApiKey(fields?.apiKey, fields?.configuration, "EmpirioLabsEmbeddings");
    const model = resolveModel(fields?.model, fields?.modelName, "EmpirioLabsEmbeddings", "text-embedding-v4");
    super({
      ...fields,
      model,
      apiKey,
      batchSize: fields?.batchSize ?? DEFAULT_EMBEDDINGS_BATCH_SIZE,
      configuration: clientOptions(fields?.configuration),
    });
  }
}

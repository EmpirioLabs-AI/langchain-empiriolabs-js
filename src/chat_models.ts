import type { LangSmithParams } from "@langchain/core/language_models/chat_models";
import type { BaseMessage, BaseMessageChunk } from "@langchain/core/messages";
import {
  ChatOpenAICompletions,
  type ChatOpenAICallOptions,
  type ChatOpenAIFields,
  type OpenAIClient,
} from "@langchain/openai";
import { clientOptions, resolveApiKey, resolveModel } from "./client.js";
import { PACKAGE_NAME, PACKAGE_VERSION, PROVIDER } from "./constants.js";
import { registerContentBlockTranslator } from "./content_blocks.js";

export interface ChatEmpirioLabsCallOptions extends ChatOpenAICallOptions {}

export interface ChatEmpirioLabsInput extends ChatOpenAIFields {
  /**
   * EmpirioLabs AI API key. Defaults to the `EMPIRIOLABS_API_KEY` environment variable.
   * Create one at https://platform.empiriolabs.ai/dashboard/api-keys.
   */
  apiKey?: ChatOpenAIFields["apiKey"];
  /**
   * Model ID from the EmpirioLabs AI catalog, for example `qwen3-8-flash`.
   * See https://docs.empiriolabs.ai/models-pricing.
   */
  model?: string;
}

/**
 * EmpirioLabs AI chat models for LangChain.js.
 *
 * Calls the EmpirioLabs AI chat completions API (`https://api.empiriolabs.ai/v1`) with your
 * EmpirioLabs AI key. Streaming, tool calling, structured output, and image input work on the
 * models that support them. A reasoning model's thinking is returned in
 * `additional_kwargs.reasoning_content` and as a `reasoning` block in `contentBlocks`.
 *
 * Setup:
 *
 * ```bash
 * npm install @empiriolabs/langchain @langchain/core
 * export EMPIRIOLABS_API_KEY="sk-empiriolabs-your_key_here"
 * ```
 *
 * @example
 * ```typescript
 * import { ChatEmpirioLabs } from "@empiriolabs/langchain";
 *
 * const llm = new ChatEmpirioLabs({ model: "qwen3-8-flash" });
 * const message = await llm.invoke("Explain backpropagation in one paragraph.");
 * console.log(message.content);
 * ```
 */
export class ChatEmpirioLabs extends ChatOpenAICompletions<ChatEmpirioLabsCallOptions> {
  static override lc_name() {
    return "ChatEmpirioLabs";
  }

  override _llmType() {
    return PROVIDER;
  }

  // Serialization keeps the parent's secret map (core merges the prototype chain base-last),
  // so the key serializes as a secret reference and its value never appears.
  override lc_serializable = true;

  override lc_namespace = ["langchain_empiriolabs", "chat_models"];

  constructor(model: string, fields?: Omit<ChatEmpirioLabsInput, "model">);
  constructor(fields?: ChatEmpirioLabsInput);
  constructor(modelOrFields?: string | ChatEmpirioLabsInput, fieldsArg?: Omit<ChatEmpirioLabsInput, "model">) {
    const fields: ChatEmpirioLabsInput =
      typeof modelOrFields === "string" ? { ...fieldsArg, model: modelOrFields } : { ...modelOrFields };
    const apiKey = resolveApiKey(fields.apiKey, fields.configuration, "ChatEmpirioLabs");
    const model = resolveModel(fields.model, fields.modelName, "ChatEmpirioLabs", "qwen3-8-flash");
    super({
      ...fields,
      model,
      apiKey,
      configuration: clientOptions(fields.configuration),
    });
    this._addVersion(PACKAGE_NAME, PACKAGE_VERSION);
    registerContentBlockTranslator();
  }

  override getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = super.getLsParams(options);
    params.ls_provider = PROVIDER;
    return params;
  }

  protected override get streamEventProvider(): string {
    return PROVIDER;
  }

  protected override _convertCompletionsDeltaToBaseMessageChunk(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delta: Record<string, any>,
    rawResponse: OpenAIClient.Chat.Completions.ChatCompletionChunk,
    defaultRole?: OpenAIClient.Chat.ChatCompletionRole,
  ): BaseMessageChunk {
    const chunk = super._convertCompletionsDeltaToBaseMessageChunk(delta, rawResponse, defaultRole);
    chunk.response_metadata = { ...chunk.response_metadata, model_provider: PROVIDER };
    return chunk;
  }

  protected override _convertCompletionsMessageToBaseMessage(
    message: OpenAIClient.ChatCompletionMessage,
    rawResponse: OpenAIClient.ChatCompletion,
  ): BaseMessage {
    const converted = super._convertCompletionsMessageToBaseMessage(message, rawResponse);
    converted.response_metadata = { ...converted.response_metadata, model_provider: PROVIDER };
    return converted;
  }
}

/** Resolves the API key, the model ID, and the client options shared by the chat model and the embeddings. */
import type { ClientOptions } from "@langchain/openai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { API_KEY_ENV_VAR, API_KEYS_URL, BASE_URL_ENV_VAR, DEFAULT_BASE_URL, MODELS_URL } from "./constants.js";

/** A key string, or a function that returns one (for keys fetched from a secret store). */
export type EmpirioLabsApiKey = string | (() => Promise<string>);

/**
 * The key passed in, then `configuration.apiKey`, then EMPIRIOLABS_API_KEY. OPENAI_API_KEY is
 * never read, so an OpenAI key is never sent to the EmpirioLabs AI API.
 */
export function resolveApiKey(
  apiKey: ClientOptions["apiKey"],
  configuration: ClientOptions | undefined,
  className: string,
): EmpirioLabsApiKey {
  for (const candidate of [apiKey, configuration?.apiKey]) {
    if (typeof candidate === "function") return candidate;
    if (typeof candidate === "string" && candidate) return candidate;
  }
  const fromEnv = getEnvironmentVariable(API_KEY_ENV_VAR);
  if (fromEnv) return fromEnv;
  throw new Error(
    `${className} needs an EmpirioLabs AI API key. Set the ${API_KEY_ENV_VAR} environment variable or pass apiKey. ` +
      `Create a key at ${API_KEYS_URL}.`,
  );
}

export function resolveModel(model: unknown, modelName: unknown, className: string, example: string): string {
  const id = (typeof model === "string" && model) || (typeof modelName === "string" && modelName);
  if (!id) {
    throw new Error(
      `${className} needs a model ID, for example new ${className}({ model: "${example}" }). ` +
        `See the models at ${MODELS_URL}.`,
    );
  }
  return id;
}

/**
 * Client options for the EmpirioLabs AI API, without the key: the key travels only in the
 * `apiKey` field, which serialization and tracing replace with a secret reference. The base URL
 * defaults to the public API, and OpenAI organization and project ids from the environment
 * (OPENAI_ORG_ID, OPENAI_PROJECT_ID, OPENAI_ORGANIZATION) are never sent; the caller can still
 * set any option explicitly.
 */
export function clientOptions(configuration: ClientOptions | undefined): ClientOptions {
  const { apiKey: _apiKey, ...rest } = configuration ?? {};
  return {
    organization: null,
    project: null,
    ...rest,
    baseURL: rest.baseURL ?? (getEnvironmentVariable(BASE_URL_ENV_VAR) || DEFAULT_BASE_URL),
  };
}

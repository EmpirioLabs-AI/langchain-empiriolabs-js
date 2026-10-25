/** Identity, endpoint, and defaults of the EmpirioLabs AI API. */

export const PACKAGE_NAME = "@empiriolabs/langchain";
/** Kept equal to package.json "version"; a unit test enforces it. */
export const PACKAGE_VERSION = "0.1.1";

/** Provider id in LangSmith traces and in message `response_metadata.model_provider`. */
export const PROVIDER = "empiriolabs";

/** OpenAI-compatible API root, including the version segment. */
export const DEFAULT_BASE_URL = "https://api.empiriolabs.ai/v1";
export const API_KEY_ENV_VAR = "EMPIRIOLABS_API_KEY";
/** Optional override of the API root, for example a proxy in front of the API. */
export const BASE_URL_ENV_VAR = "EMPIRIOLABS_API_BASE";

export const API_KEYS_URL = "https://platform.empiriolabs.ai/dashboard/api-keys";
export const MODELS_URL = "https://docs.empiriolabs.ai/models-pricing";

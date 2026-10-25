# Changelog

## 0.1.1

- Published from the Publish workflow through npm trusted publishing (OpenID Connect), with no stored npm token.

## 0.1.0

- First release, for LangChain.js 1 (`@langchain/core` 1.3 or later) on Node.js 22 or later.
- `ChatEmpirioLabs`: chat models from the EmpirioLabs AI catalog, with streaming, tool calling, structured output (JSON schema or function calling), and image input. A reasoning model's thinking is returned in `additional_kwargs.reasoning_content` and as a `reasoning` block in `contentBlocks`. LangSmith traces name the provider `empiriolabs`.
- `EmpirioLabsEmbeddings`: embeddings for retrieval and vector stores.
- The API key is read from `apiKey` or `EMPIRIOLABS_API_KEY`, and serializes as a secret reference, never its value. OpenAI environment variables are ignored.

# @empiriolabs/langchain

LangChain.js integration for [EmpirioLabs AI](https://empiriolabs.ai): `ChatEmpirioLabs` chat models and `EmpirioLabsEmbeddings`.

- Chat with any chat model in the [EmpirioLabs AI catalog](https://docs.empiriolabs.ai/models-pricing), with streaming, tool calling, structured output, and image input on the models that support them.
- A reasoning model's thinking comes back in `additional_kwargs.reasoning_content` and as a `reasoning` block in `contentBlocks`.
- Works with `createAgent` from `langchain` and with LangGraph.
- Embeddings for retrieval, sent in batches the API accepts.

## Install

```bash
npm install @empiriolabs/langchain @langchain/core
```

Create an API key at [platform.empiriolabs.ai](https://platform.empiriolabs.ai/dashboard/api-keys) and set it:

```bash
export EMPIRIOLABS_API_KEY="sk-empiriolabs-your_key_here"
```

## Chat

```ts
import { ChatEmpirioLabs } from "@empiriolabs/langchain";

const llm = new ChatEmpirioLabs({ model: "qwen3-8-flash" });

const message = await llm.invoke("Explain backpropagation in one paragraph.");
console.log(message.content);
```

Stream the answer:

```ts
for await (const chunk of await llm.stream("Write a haiku about the sea.")) {
  process.stdout.write(String(chunk.content));
}
```

Read a reasoning model's thinking, or turn it off for a faster answer:

```ts
const answer = await llm.invoke("What is 17 times 23?");
console.log(answer.contentBlocks); // [{ type: "reasoning", ... }, { type: "text", text: "391" }]

const quick = new ChatEmpirioLabs({ model: "qwen3-8-flash", modelKwargs: { reasoning_effort: "none" } });
```

## Tools and agents

```ts
import { tool } from "@langchain/core/tools";
import { createAgent } from "langchain";
import * as z from "zod";

const getWeather = tool(async ({ city }) => `It is 21 C and sunny in ${city}.`, {
  name: "get_weather",
  description: "Get the current weather for a city.",
  schema: z.object({ city: z.string() }),
});

const agent = createAgent({ model: llm, tools: [getWeather] });
const result = await agent.invoke({ messages: [{ role: "user", content: "What is the weather in Tokyo?" }] });
console.log(result.messages.at(-1)?.content);
```

`llm.bindTools([getWeather])` binds tools without an agent loop.

## Structured output

```ts
const Movie = z.object({ title: z.string(), year: z.number() });

const movie = await llm.withStructuredOutput(Movie).invoke("Name one movie directed by Denis Villeneuve.");
// { title: "Dune", year: 2021 }
```

Pass `{ method: "functionCalling" }` or `{ method: "jsonSchema" }` to choose how the schema is sent.

## Images

```ts
import { HumanMessage } from "@langchain/core/messages";

const reply = await llm.invoke([
  new HumanMessage({
    content: [
      { type: "text", text: "Describe this image." },
      { type: "image_url", image_url: { url: "https://example.com/photo.jpg" } },
    ],
  }),
]);
```

## Embeddings

```ts
import { EmpirioLabsEmbeddings } from "@empiriolabs/langchain";

const embeddings = new EmpirioLabsEmbeddings({ model: "text-embedding-v4" });

const vector = await embeddings.embedQuery("What is EmpirioLabs AI?");
const vectors = await embeddings.embedDocuments(["First document", "Second document"]);
```

`embedDocuments` sends 10 inputs per request, the most `text-embedding-v4` accepts. Set `batchSize` for a model that takes more, and `dimensions` to choose the vector size on models that support it.

## Configuration

| Option | Default | |
| --- | --- | --- |
| `model` | required | A model ID from [Models & Pricing](https://docs.empiriolabs.ai/models-pricing) |
| `apiKey` | `EMPIRIOLABS_API_KEY` | A key string, or a function that returns one |
| `configuration.baseURL` | `EMPIRIOLABS_API_BASE`, then `https://api.empiriolabs.ai/v1` | |
| `temperature`, `maxTokens`, `topP`, `stop`, `timeout`, `maxRetries` | the model's defaults | The usual LangChain chat model options |
| `modelKwargs` | | Any other request parameter the model supports, for example `reasoning_effort` |

The OpenAI environment variables (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID`) are ignored.

## Links

- [EmpirioLabs AI documentation](https://docs.empiriolabs.ai)
- [LangChain guide](https://docs.empiriolabs.ai/integrations#langchain)
- [Models & Pricing](https://docs.empiriolabs.ai/models-pricing)
- Python: [`langchain-empiriolabs`](https://pypi.org/project/langchain-empiriolabs/)

## License

MIT

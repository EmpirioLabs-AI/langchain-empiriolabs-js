/** A fetch double for the OpenAI-compatible client: records each request and answers from a handler. */

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Headers;
  body: Record<string, unknown>;
}

type Reply = Response | (() => Response);

export function fakeFetch(replies: Reply | Reply[]) {
  const queue = Array.isArray(replies) ? [...replies] : null;
  const requests: RecordedRequest[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const text = typeof init?.body === "string" ? init.body : "";
    requests.push({
      url,
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
    });
    const reply = queue ? queue.shift() : (replies as Reply);
    if (!reply) throw new Error(`No reply left for request ${requests.length} to ${url}`);
    return typeof reply === "function" ? reply() : reply.clone();
  };
  return { fetch, requests };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function sseResponse(events: unknown[]): () => Response {
  return () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
  };
}

export function chatCompletion(message: Record<string, unknown>, usage?: Record<string, unknown>) {
  return {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 1_790_000_000,
    model: "qwen3-8-flash",
    choices: [{ index: 0, message: { role: "assistant", ...message }, finish_reason: "stop" }],
    usage: usage ?? { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
  };
}

export function chunk(delta: Record<string, unknown>, finishReason: string | null = null, usage?: unknown) {
  return {
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 1_790_000_000,
    model: "qwen3-8-flash",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
    ...(usage ? { usage } : {}),
  };
}

export function embeddingsResponse(inputs: number, dimensions = 4) {
  return {
    object: "list",
    model: "text-embedding-v4",
    data: Array.from({ length: inputs }, (_, index) => ({
      object: "embedding",
      index,
      embedding: Array.from({ length: dimensions }, (_, i) => (index + 1) / (i + 2)),
    })),
    usage: { prompt_tokens: inputs * 3, total_tokens: inputs * 3 },
  };
}

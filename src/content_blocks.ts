/**
 * Standard content blocks for EmpirioLabs AI messages: the reasoning a model returns in
 * `reasoning_content`, then the text, then the tool calls.
 */
import type { AIMessage, AIMessageChunk, ContentBlock } from "@langchain/core/messages";
import { PROVIDER } from "./constants.js";

export function convertToStandardContentBlocks(message: AIMessage | AIMessageChunk): ContentBlock.Standard[] {
  const blocks: ContentBlock.Standard[] = [];
  const reasoning = message.additional_kwargs?.reasoning_content;
  if (typeof reasoning === "string" && reasoning.length > 0) {
    blocks.push({ type: "reasoning", reasoning });
  }
  if (typeof message.content === "string") {
    if (message.content.length > 0) blocks.push({ type: "text", text: message.content });
  } else {
    for (const block of message.content) {
      if (block.type === "text" && typeof block.text === "string") blocks.push({ type: "text", text: block.text });
    }
  }
  for (const call of message.tool_calls ?? []) {
    blocks.push({ type: "tool_call", id: call.id, name: call.name, args: call.args });
  }
  return blocks;
}

interface Translator {
  translateContent: (message: AIMessage) => ContentBlock.Standard[];
  translateContentChunk: (chunk: AIMessageChunk) => ContentBlock.Standard[];
}

const translator: Translator = {
  translateContent: convertToStandardContentBlocks,
  translateContentChunk: convertToStandardContentBlocks,
};

/**
 * Adds the translator to @langchain/core's provider registry (shared through `globalThis` so
 * that every copy of core sees it), keyed by the `model_provider` this package sets. Without
 * a registry, `contentBlocks` falls back to core's generic text and tool call blocks.
 */
export function registerContentBlockTranslator(): void {
  const registry = (globalThis as { lc_block_translators_registry?: unknown }).lc_block_translators_registry;
  if (registry instanceof Map && !registry.has(PROVIDER)) registry.set(PROVIDER, translator);
}

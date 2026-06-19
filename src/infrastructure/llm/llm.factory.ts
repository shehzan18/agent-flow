import { LLMProvider } from "./llm.types";
import { GeminiProvider } from "./gemini.provider";
import { OpenAIProvider } from "./openai.provider";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

// Cache provider instances so we don't recreate them on every call
const providerCache = new Map<string, LLMProvider>();

function buildProvider(name: string): LLMProvider {
  switch (name.toLowerCase()) {
    case "gemini":
      return new GeminiProvider();
    case "openai":
      return new OpenAIProvider();
    case "anthropic":
      throw new Error("Anthropic provider not implemented yet");
    default:
      throw new Error(`Unknown LLM provider: ${name}`);
  }
}

function getProvider(name: string): LLMProvider {
  if (!providerCache.has(name)) {
    const provider = buildProvider(name);
    providerCache.set(name, provider);
    logger.info("LLM provider initialized", { provider: name });
  }
  return providerCache.get(name)!;
}

// Provider for completions (agent reasoning, classifier, merge)
export function getCompletionProvider(): LLMProvider {
  return getProvider(env.LLM_COMPLETION_PROVIDER);
}

// Provider for embeddings (RAG, memory vectors)
export function getEmbeddingProvider(): LLMProvider {
  return getProvider(env.LLM_EMBEDDING_PROVIDER);
}

// Backwards-compatible default — returns the completion provider.
// Existing code calling getLLMProvider() keeps working.
export function getLLMProvider(providerOverride?: string): LLMProvider {
  if (providerOverride) {
    return getProvider(providerOverride);
  }
  return getCompletionProvider();
}
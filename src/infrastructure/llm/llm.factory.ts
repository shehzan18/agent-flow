import { LLMProvider } from "./llm.types";
import { GeminiProvider } from "./gemini.provider";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

// Cache providers so we don't create new instances every call
const providerCache = new Map<string, LLMProvider>();

export function getLLMProvider(providerName?: string): LLMProvider {
  const name = providerName || env.LLM_PROVIDER;

  // Return cached instance if exists
  if (providerCache.has(name)) {
    return providerCache.get(name)!;
  }

  // Create new provider
  let provider: LLMProvider;

  switch (name) {
    case "gemini":
      provider = new GeminiProvider();
      break;

    case "openai":
      throw new Error("OpenAI provider not implemented yet");

    case "anthropic":
      throw new Error("Anthropic provider not implemented yet");

    default:
      throw new Error(`Unknown LLM provider: ${name}`);
  }

  providerCache.set(name, provider);

  logger.info("LLM provider initialized", { provider: name });

  return provider;
}
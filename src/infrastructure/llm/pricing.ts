import { logger } from "../../config/logger";

// Prices in USD per single token (rate per million ÷ 1,000,000)
interface TokenPriceRate {
  input: number;
  output: number;
}

const PER_MILLION = 1_000_000;

const PRICING: Record<string, TokenPriceRate> = {
  // OpenAI
  "openai:gpt-4o-mini": {
    input: 0.15 / PER_MILLION,
    output: 0.6 / PER_MILLION,
  },
  "openai:gpt-4o": {
    input: 2.5 / PER_MILLION,
    output: 10.0 / PER_MILLION,
  },

  // Anthropic (Claude)
  "anthropic:claude-3-5-sonnet": {
    input: 3.0 / PER_MILLION,
    output: 15.0 / PER_MILLION,
  },
  "anthropic:claude-3-5-haiku": {
    input: 0.8 / PER_MILLION,
    output: 4.0 / PER_MILLION,
  },

  // Gemini — free tier
  "gemini:gemini-flash-latest": { input: 0, output: 0 },
  "gemini:gemini-2.5-flash": { input: 0, output: 0 },
  "gemini:gemini-2.0-flash": { input: 0, output: 0 },
};

export function computeCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const key = `${provider}:${model}`;
  const rate = PRICING[key];

  if (!rate) {
    logger.warn("No pricing found for model, defaulting cost to 0", {
      provider,
      model,
      key,
    });
    return 0;
  }

  const cost = inputTokens * rate.input + outputTokens * rate.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function inferProvider(model: string): string {
  if (model.startsWith("gpt")) return "openai";
  if (model.startsWith("claude")) return "anthropic";
  if (model.startsWith("gemini")) return "gemini";
  return "unknown";
}
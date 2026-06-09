// What a message looks like — same as OpenAI/Anthropic chat format
export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Request to the LLM
export interface LLMCompletionRequest {
  messages: LLMMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

// Response from the LLM
export interface LLMCompletionResponse {
  content: string;
  model: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  latencyMs: number;
  finishReason?: string;
}

// Provider interface — every provider must implement this
export interface LLMProvider {
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
  embed(text: string): Promise<number[]>;
  getProviderName(): string;
}

// Errors
export class LLMError extends Error {
  constructor(
    message: string,
    public provider: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(provider: string, retryAfterMs?: number) {
    super(`Rate limit hit on ${provider}`, provider, 429);
    this.name = "LLMRateLimitError";
  }
}
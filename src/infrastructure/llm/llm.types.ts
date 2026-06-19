import { ToolDefinition, ToolInput } from "../../modules/tools/tool.types";

// What a message looks like — same as OpenAI/Anthropic chat format
export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  // When an assistant message requests tools, the calls live here
  toolCalls?: LLMFunctionCall[];
  // When a tool message returns a result, it references the call id
  toolCallId?: string;
  name?: string;
}

// A function call returned by the LLM
export interface LLMFunctionCall {
  name: string;
  arguments: ToolInput;
  callId?: string;
}

// Tool result sent back to the LLM
export interface LLMToolResult {
  callId?: string;
  toolName: string;
  result: any;
  error?: string;
}

// Request to the LLM
export interface LLMCompletionRequest {
  messages: LLMMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  toolResults?: LLMToolResult[];
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
  functionCalls?: LLMFunctionCall[];
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
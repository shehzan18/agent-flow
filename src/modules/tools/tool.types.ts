// JSON Schema for tool parameters — what arguments the tool accepts
export interface ToolParameter {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required?: boolean;
  enum?: string[];
  items?: ToolParameter;
}

// Standard tool definition — every tool implements this
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  category?: "math" | "search" | "data" | "api" | "utility";
}

// What gets passed to a tool when executed
export interface ToolInput {
  [key: string]: any;
}

// Standard tool result format
export interface ToolResult {
  success: boolean;
  output?: any;
  error?: string;
  metadata?: {
    latencyMs?: number;
    cost?: number;
  };
}

// The actual tool — definition + executor
export interface Tool {
  definition: ToolDefinition;
  execute(input: ToolInput): Promise<ToolResult>;
}

// Format that LLMs use for function calling (Gemini, OpenAI, Anthropic-compatible)
export interface ToolCall {
  toolName: string;
  arguments: ToolInput;
  callId?: string;
}

// Trace of a tool execution (for replay/debugging)
export interface ToolExecutionTrace {
  toolName: string;
  input: ToolInput;
  result: ToolResult;
  timestamp: string;
  durationMs: number;
}
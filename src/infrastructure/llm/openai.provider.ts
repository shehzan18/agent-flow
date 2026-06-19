import OpenAI from "openai";
import {
  LLMProvider,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMMessage,
  LLMError,
  LLMRateLimitError,
} from "./llm.types";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private defaultModel: string;

  constructor() {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required to use OpenAI provider");
    }

    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.defaultModel = "gpt-4o-mini";
  }

  getProviderName(): string {
    return "openai";
  }

  async complete(
    request: LLMCompletionRequest
  ): Promise<LLMCompletionResponse> {
    const startTime = Date.now();
    const modelName = request.model || this.defaultModel;

    try {
      // Build messages array (OpenAI includes system as a message)
      const messages: any[] = [];

      if (request.systemPrompt) {
        messages.push({ role: "system", content: request.systemPrompt });
      }

      for (const m of request.messages) {
        if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
          // Assistant message that requested tools
          messages.push({
            role: "assistant",
            content: m.content || null,
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.callId,
              type: "function",
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments || {}),
              },
            })),
          });
        } else if (m.role === "tool") {
          // Tool result message
          messages.push({
            role: "tool",
            tool_call_id: m.toolCallId,
            content: m.content,
          });
        } else {
          messages.push({ role: m.role, content: m.content });
        }
      }

      // Convert our tools to OpenAI's function format
      const tools =
        request.tools && request.tools.length > 0
          ? this.convertTools(request.tools)
          : undefined;

      logger.debug("Calling OpenAI", {
        model: modelName,
        messageCount: messages.length,
        hasTools: !!tools,
      });

      const response = await this.client.chat.completions.create({
        model: modelName,
        messages,
        max_tokens: request.maxTokens || 2048,
        temperature: request.temperature ?? 0.7,
        ...(tools && { tools }),
      });

      const choice = response.choices[0];
      const text = choice.message.content || "";
      const usage = response.usage;
      const latencyMs = Date.now() - startTime;

      // Extract function calls if any
      const functionCalls = (choice.message.tool_calls || []).map((tc: any) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || "{}"),
        callId: tc.id,
      }));

      logger.info("OpenAI call successful", {
        model: modelName,
        latencyMs,
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.completion_tokens,
        functionCallCount: functionCalls.length,
      });

      return {
        content: text,
        model: modelName,
        tokensUsed: {
          input: usage?.prompt_tokens || 0,
          output: usage?.completion_tokens || 0,
          total: usage?.total_tokens || 0,
        },
        latencyMs,
        finishReason: choice.finish_reason,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      };
    } catch (error: any) {
      logger.error("OpenAI call failed", {
        model: modelName,
        error: error.message,
      });

      if (error.status === 429) {
        throw new LLMRateLimitError("openai");
      }

      throw new LLMError(
        error.message || "OpenAI call failed",
        "openai",
        error.status
      );
    }
  }

  // embed() should not be called on OpenAI in our split setup —
  // embeddings route to Gemini. But we implement it for completeness.
  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error: any) {
      logger.error("OpenAI embedding failed", { error: error.message });
      throw new LLMError(error.message || "OpenAI embedding failed", "openai");
    }
  }

  // Convert our tool definitions to OpenAI's function-calling format
  private convertTools(tools: any[]): any[] {
    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: Object.fromEntries(
            Object.entries(tool.parameters).map(([key, param]: [string, any]) => [
              key,
              {
                type: param.type,
                description: param.description,
                ...(param.enum && { enum: param.enum }),
              },
            ])
          ),
          required: Object.entries(tool.parameters)
            .filter(([_, param]: [string, any]) => param.required)
            .map(([key]) => key),
        },
      },
    }));
  }
}
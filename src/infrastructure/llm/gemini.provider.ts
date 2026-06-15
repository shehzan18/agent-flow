import { GoogleGenAI } from "@google/genai";
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

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI;
  private defaultModel: string;

  constructor() {
    if (!env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is required to use Gemini provider");
    }

    this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    this.defaultModel = env.GEMINI_MODEL;
  }

  getProviderName(): string {
    return "gemini";
  }

  async complete(
    request: LLMCompletionRequest
  ): Promise<LLMCompletionResponse> {
    const startTime = Date.now();
    const modelName = request.model || this.defaultModel;

    try {
      const contents = this.convertMessages(request.messages);

      // Append tool results if this is a follow-up call after tool execution
      if (request.toolResults && request.toolResults.length > 0) {
        for (const toolResult of request.toolResults) {
          contents.push({
            role: "function",
            parts: [
              {
                functionResponse: {
                  name: toolResult.toolName,
                  response: toolResult.error
                    ? { error: toolResult.error }
                    : { result: toolResult.result },
                },
              },
            ],
          } as any);
        }
      }

      // Convert our tool definitions to Gemini's format
      const geminiTools =
        request.tools && request.tools.length > 0
          ? [
              {
                functionDeclarations: this.convertToolsToGeminiFormat(
                  request.tools
                ),
              },
            ]
          : undefined;

      logger.debug("Calling Gemini", {
        model: modelName,
        messageCount: contents.length,
        hasTools: !!geminiTools,
        toolCount: request.tools?.length || 0,
      });

      const response = await this.client.models.generateContent({
        model: modelName,
        contents,
        config: {
          maxOutputTokens: request.maxTokens || 2048,
          temperature: request.temperature ?? 0.7,
          systemInstruction: request.systemPrompt,
          ...(geminiTools && { tools: geminiTools }),
        } as any,
      });

      const text = response.text || "";
      const usage = response.usageMetadata;
      const latencyMs = Date.now() - startTime;

      const functionCalls = this.extractFunctionCalls(response);

      logger.info("Gemini call successful", {
        model: modelName,
        latencyMs,
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount,
        functionCallCount: functionCalls.length,
      });

      return {
        content: text,
        model: modelName,
        tokensUsed: {
          input: usage?.promptTokenCount || 0,
          output: usage?.candidatesTokenCount || 0,
          total: usage?.totalTokenCount || 0,
        },
        latencyMs,
        finishReason: response.candidates?.[0]?.finishReason,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      };
    } catch (error: any) {
      logger.error("Gemini call failed", {
        model: modelName,
        error: error.message,
      });

      if (error.status === 429 || error.message?.includes("429")) {
        throw new LLMRateLimitError("gemini");
      }

      throw new LLMError(
        error.message || "Gemini call failed",
        "gemini",
        error.status
      );
    }
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.client.models.embedContent({
        model: "gemini-embedding-001",
        contents: text,
        config: {
          outputDimensionality: 768,
        },
      });

      const embedding = response.embeddings?.[0]?.values;

      if (!embedding) {
        throw new Error("No embedding returned from Gemini");
      }

      return embedding;
    } catch (error: any) {
      logger.error("Gemini embedding failed", { error: error.message });
      throw new LLMError(
        error.message || "Gemini embedding failed",
        "gemini"
      );
    }
  }

  // Convert our standard message format to Gemini's format
  private convertMessages(messages: LLMMessage[]) {
    return messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
  }

  // Convert our tool definitions to Gemini's functionDeclarations format
  private convertToolsToGeminiFormat(tools: any[]): any[] {
    return tools.map((tool) => ({
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
    }));
  }

  // Extract function calls from Gemini response
  private extractFunctionCalls(
    response: any
  ): Array<{ name: string; arguments: any; callId?: string }> {
    const calls: Array<{ name: string; arguments: any; callId?: string }> = [];

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) return calls;

    for (const part of candidate.content.parts) {
      if (part.functionCall) {
        calls.push({
          name: part.functionCall.name,
          arguments: part.functionCall.args || {},
        });
      }
    }

    return calls;
  }
}
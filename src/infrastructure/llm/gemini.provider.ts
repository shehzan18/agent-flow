import { GoogleGenerativeAI } from "@google/generative-ai";
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
  private client: GoogleGenerativeAI;
  private defaultModel: string;

  constructor() {
    if (!env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is required to use Gemini provider");
    }

    this.client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
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
      const model = this.client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: request.maxTokens || 1024,
          temperature: request.temperature ?? 0.7,
        },
        systemInstruction: request.systemPrompt,
      });

      // Convert our format to Gemini's format
      const geminiMessages = this.convertMessages(request.messages);

      logger.debug("Calling Gemini", {
        model: modelName,
        messageCount: geminiMessages.length,
      });

      const result = await model.generateContent({
        contents: geminiMessages,
      });

      const response = result.response;
      const text = response.text();
      const usage = response.usageMetadata;

      const latencyMs = Date.now() - startTime;

      logger.info("Gemini call successful", {
        model: modelName,
        latencyMs,
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount,
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
      const model = this.client.getGenerativeModel({
        model: "text-embedding-004",
      });

      const result = await model.embedContent(text);
      return result.embedding.values;
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
      .filter((m) => m.role !== "system") // system goes in systemInstruction, not messages
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
  }
}
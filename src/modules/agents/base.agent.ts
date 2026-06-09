import { getLLMProvider } from "../../infrastructure/llm/llm.factory";
import {
  LLMProvider,
  LLMMessage,
  LLMCompletionResponse,
} from "../../infrastructure/llm/llm.types";
import { logger } from "../../config/logger";

export interface AgentInput {
  query: string;
  context?: Record<string, any>;
  previousMessages?: LLMMessage[];
}

export interface AgentOutput {
  content: string;
  reasoning?: string;
  metadata: {
    model: string;
    tokensUsed: {
      input: number;
      output: number;
      total: number;
    };
    latencyMs: number;
  };
  messages: LLMMessage[];
}

export abstract class BaseAgent {
  protected llm: LLMProvider;
  protected agentName: string;

  constructor(agentName: string, providerOverride?: string) {
    this.llm = getLLMProvider(providerOverride);
    this.agentName = agentName;
  }

  // Each agent must implement these
  protected abstract getSystemPrompt(): string;
  protected abstract formatUserMessage(input: AgentInput): string;

  // Main execution method — same for all agents
  async run(
    input: AgentInput,
    config?: { model?: string; temperature?: number; maxTokens?: number }
  ): Promise<AgentOutput> {
    logger.info(`${this.agentName} agent starting`, {
      hasContext: !!input.context,
      previousMessages: input.previousMessages?.length || 0,
    });

    // Build message list
    const messages: LLMMessage[] = [];

    // Add previous conversation if exists
    if (input.previousMessages && input.previousMessages.length > 0) {
      messages.push(...input.previousMessages);
    }

    // Add current user message
    const userMessage: LLMMessage = {
      role: "user",
      content: this.formatUserMessage(input),
    };
    messages.push(userMessage);

    // Call LLM
    const response: LLMCompletionResponse = await this.llm.complete({
      messages,
      systemPrompt: this.getSystemPrompt(),
      model: config?.model,
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 2048,
    });

    // Build full conversation history including this turn
    const fullMessages: LLMMessage[] = [
      ...messages,
      {
        role: "assistant",
        content: response.content,
      },
    ];

    logger.info(`${this.agentName} agent completed`, {
      tokensUsed: response.tokensUsed.total,
      latencyMs: response.latencyMs,
    });

    return {
      content: response.content,
      metadata: {
        model: response.model,
        tokensUsed: response.tokensUsed,
        latencyMs: response.latencyMs,
      },
      messages: fullMessages,
    };
  }
}
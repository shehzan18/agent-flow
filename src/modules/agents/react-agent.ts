import { BaseAgent, AgentInput, AgentOutput } from "./base.agent";
import { toolRegistry } from "../tools/tool.registry";
import { ToolExecutor } from "../tools/tool.executor";
import {
  LLMMessage,
  LLMToolResult,
  LLMCompletionResponse,
} from "../../infrastructure/llm/llm.types";
import { logger } from "../../config/logger";

export interface ReActAgentConfig {
  allowedTools?: string[];      // restrict which tools this agent can use
  maxIterations?: number;        // safety limit
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class ReActAgent extends BaseAgent {
  private toolExecutor: ToolExecutor;

  constructor(providerOverride?: string) {
    super("ReActAgent", providerOverride);
    this.toolExecutor = new ToolExecutor();
  }

  protected getSystemPrompt(): string {
    return `You are a helpful AI assistant with access to tools.

When the user asks a question that requires using a tool (math, web fetching, document search, etc.), call the appropriate tool with correct parameters.

Guidelines:
- Always use tools when they're appropriate — don't try to do math manually
- Think step by step about which tool to use
- After receiving tool results, decide if you need more tool calls or have enough info
- When you have enough info, provide a clear, helpful final answer
- Be concise and direct`;
  }

  protected formatUserMessage(input: AgentInput): string {
    let message = input.query;

    if (input.context) {
      const contextStr = JSON.stringify(input.context, null, 2);
      message += `\n\nContext:\n${contextStr}`;
    }

    return message;
  }

  async run(
    input: AgentInput,
    config?: ReActAgentConfig
  ): Promise<AgentOutput> {
    const maxIterations = config?.maxIterations ?? 8;

    const tools = config?.allowedTools
      ? toolRegistry.getByNames(config.allowedTools).map((t) => t.definition)
      : toolRegistry.getAllDefinitions();

    logger.info("ReAct agent starting", {
      query: input.query.substring(0, 100),
      availableTools: tools.length,
      maxIterations,
    });

    const messages: LLMMessage[] = [];
    if (input.previousMessages) {
      messages.push(...input.previousMessages);
    }
    messages.push({
      role: "user",
      content: this.formatUserMessage(input),
    });

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalLatency = 0;
    let lastResponse: LLMCompletionResponse | null = null;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      logger.debug("ReAct iteration", { iteration: iteration + 1, maxIterations });

      const response = await this.llm.complete({
        messages,
        systemPrompt: this.getSystemPrompt(),
        tools,
        model: config?.model,
        temperature: config?.temperature ?? 0.7,
        maxTokens: config?.maxTokens ?? 2048,
      });

      lastResponse = response;
      totalInputTokens += response.tokensUsed.input;
      totalOutputTokens += response.tokensUsed.output;
      totalLatency += response.latencyMs;

      // LLM wants to call tools
      if (response.functionCalls && response.functionCalls.length > 0) {
        logger.info("LLM requested tool calls", {
          iteration: iteration + 1,
          toolCount: response.functionCalls.length,
          tools: response.functionCalls.map((fc) => fc.name),
        });

        // Push the assistant message WITH its tool calls (required pairing)
        messages.push({
          role: "assistant",
          content: response.content || "",
          toolCalls: response.functionCalls,
        });

        // Execute the tools
        const toolCalls = response.functionCalls.map((fc) => ({
          toolName: fc.name,
          arguments: fc.arguments,
          callId: fc.callId,
        }));

        const results = await this.toolExecutor.executeBatch(toolCalls);

        // Push each tool result as a tool message referencing its call
        results.forEach((result, idx) => {
          const fc = response.functionCalls![idx];
          messages.push({
            role: "tool",
            toolCallId: fc.callId,
            name: fc.name,
            content: JSON.stringify(
              result.success ? { result: result.output } : { error: result.error }
            ),
          });
        });

        continue;
      }

      // No tool calls — final answer
      logger.info("ReAct loop complete — final answer received", {
        iteration: iteration + 1,
        contentLength: response.content.length,
      });

      messages.push({
        role: "assistant",
        content: response.content,
      });

      return {
        content: response.content,
        metadata: {
          model: response.model,
          tokensUsed: {
            input: totalInputTokens,
            output: totalOutputTokens,
            total: totalInputTokens + totalOutputTokens,
          },
          latencyMs: totalLatency,
        },
        messages,
      };
    }

    logger.warn("ReAct loop hit max iterations", { maxIterations });

    return {
      content:
        lastResponse?.content ||
        "Agent reached maximum iterations without a final answer.",
      metadata: {
        model: lastResponse?.model || "unknown",
        tokensUsed: {
          input: totalInputTokens,
          output: totalOutputTokens,
          total: totalInputTokens + totalOutputTokens,
        },
        latencyMs: totalLatency,
      },
      messages,
    };
  }
}
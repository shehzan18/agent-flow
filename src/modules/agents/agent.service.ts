import { PlannerAgent } from "./planner.agent";
import { ResearcherAgent } from "./researcher.agent";
import { CriticAgent } from "./critic.agent";
import { WriterAgent } from "./writer.agent";
import { AgentInput, AgentOutput, BaseAgent } from "./base.agent";
import { logger } from "../../config/logger";

export type AgentType = "planner" | "researcher" | "critic" | "writer";

export interface RunAgentParams {
  agentType: AgentType;
  input: AgentInput;
  config?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    providerOverride?: string;
  };
}

export interface ParsedAgentResult {
  rawContent: string;
  parsed: Record<string, any>;
  metadata: AgentOutput["metadata"];
  messages: AgentOutput["messages"];
}

export class AgentService {
  private getAgent(agentType: AgentType, providerOverride?: string): BaseAgent {
    switch (agentType) {
      case "planner":
        return new PlannerAgent(providerOverride);
      case "researcher":
        return new ResearcherAgent(providerOverride);
      case "critic":
        return new CriticAgent(providerOverride);
      case "writer":
        return new WriterAgent(providerOverride);
      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }
  }

  async runAgent(params: RunAgentParams): Promise<ParsedAgentResult> {
    const { agentType, input, config } = params;

    logger.info("Running agent", { agentType });

    const agent = this.getAgent(agentType, config?.providerOverride);

    const output = await agent.run(input, {
      model: config?.model,
      temperature: config?.temperature,
      maxTokens: config?.maxTokens,
    });

    // Parse JSON response
    const parsed = this.parseJSONResponse(output.content);

    return {
      rawContent: output.content,
      parsed,
      metadata: output.metadata,
      messages: output.messages,
    };
  }

  private parseJSONResponse(content: string): Record<string, any> {
    try {
      // Try direct parse first
      return JSON.parse(content);
    } catch (e) {
      // Strip markdown code blocks if present
      const cleaned = this.stripMarkdownCodeBlocks(content);

      try {
        return JSON.parse(cleaned);
      } catch (e2) {
        logger.warn("Failed to parse agent JSON response", {
          content: content.substring(0, 200),
        });

        // Return content wrapped — don't crash the whole workflow
        return {
          _rawText: content,
          _parseError: true,
        };
      }
    }
  }

  private stripMarkdownCodeBlocks(content: string): string {
    return content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }
}
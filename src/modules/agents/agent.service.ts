import { PlannerAgent } from "./planner.agent";
import { ResearcherAgent } from "./researcher.agent";
import { CriticAgent } from "./critic.agent";
import { WriterAgent } from "./writer.agent";
import { AgentInput, AgentOutput, BaseAgent } from "./base.agent";
import { logger } from "../../config/logger";
import { ReActAgent } from "./react-agent";

export type AgentType = "planner" | "researcher" | "critic" | "writer" | "react";

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
    case "react":
        return new ReActAgent(providerOverride);
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
    ...(agentType === "react" && config && "allowedTools" in config
        ? { allowedTools: (config as any).allowedTools }
        : {}),
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

  // private parseJSONResponse(content: string): Record<string, any> {
  //   try {
  //     // Try direct parse first
  //     return JSON.parse(content);
  //   } catch (e) {
  //     // Strip markdown code blocks if present
  //     const cleaned = this.stripMarkdownCodeBlocks(content);

  //     try {
  //       return JSON.parse(cleaned);
  //     } catch (e2) {
  //       logger.warn("Failed to parse agent JSON response", {
  //         content: content.substring(0, 200),
  //       });

  //       // Return content wrapped — don't crash the whole workflow
  //       return {
  //         _rawText: content,
  //         _parseError: true,
  //       };
  //     }
  //   }
  // }

  private parseJSONResponse(content: string): Record<string, any> {
    // 1. Try direct parse
    try {
      return JSON.parse(content);
    } catch {}

    // 2. Strip markdown code fences and try again
    const cleaned = this.stripMarkdownCodeBlocks(content);
    try {
      return JSON.parse(cleaned);
    } catch {}

    // 3. Extract the first {...} block from surrounding text and try that
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}

      // 4. Last resort on the extracted block: escape stray backslashes
      //    (LaTeX like \[ ... \] breaks JSON.parse)
      try {
        const escaped = match[0].replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
        return JSON.parse(escaped);
      } catch {}
    }

    // 5. Genuinely not JSON (e.g. a ReAct agent's plain-text answer).
    //    Treat the text itself as the answer — clean, not an error blob.
    logger.debug("Agent returned plain text (not JSON) — using as answer", {
      preview: content.substring(0, 120),
    });
    return {
      answer: content.trim(),
      summary: content.trim(),
    };
  }

  private stripMarkdownCodeBlocks(content: string): string {
    return content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }
}
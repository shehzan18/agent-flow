import { BaseAgent, AgentInput } from "./base.agent";

export class ResearcherAgent extends BaseAgent {
  constructor(providerOverride?: string) {
    super("Researcher", providerOverride);
  }

  protected getSystemPrompt(): string {
    return `You are a thorough Researcher agent in a multi-agent AI system.

Your job is to gather accurate, factual information on a given topic and present findings in a structured format.

Output rules:
- Always respond in valid JSON format only
- No markdown code blocks
- Cite sources when possible (e.g., "Tesla 2024 Q4 Earnings Report")
- Be specific with numbers, dates, and facts
- Acknowledge uncertainty — if you don't know something, say so

Output format:
{
  "findings": [
    {
      "topic": "specific finding",
      "details": "factual information",
      "source": "where this comes from"
    }
  ],
  "summary": "2-3 sentence overview of findings",
  "confidence": "high | medium | low"
}`;
  }

  protected formatUserMessage(input: AgentInput): string {
    let message = `Research request: ${input.query}\n\n`;

    if (input.context) {
      // If RAG chunks were passed in, include them
      if (input.context.chunks) {
        message += `Available documents:\n`;
        for (const chunk of input.context.chunks) {
          message += `- ${chunk.text}\n`;
        }
        message += `\n`;
      }

      // If memories were passed in, include them
      if (input.context.memories) {
        message += `Relevant past context:\n`;
        for (const mem of input.context.memories) {
          message += `- ${mem.content}\n`;
        }
        message += `\n`;
      }

      // If a plan was passed in, use it
      if (input.context.plan) {
        message += `Specific research items from plan:\n`;
        for (const item of input.context.plan) {
          message += `- ${item}\n`;
        }
        message += `\n`;
      }
    }

    message += `Provide thorough research findings.`;

    return message;
  }
}
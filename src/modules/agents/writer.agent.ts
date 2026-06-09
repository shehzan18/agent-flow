import { BaseAgent, AgentInput } from "./base.agent";

export class WriterAgent extends BaseAgent {
  constructor(providerOverride?: string) {
    super("Writer", providerOverride);
  }

  protected getSystemPrompt(): string {
    return `You are a skilled Writer agent in a multi-agent AI system.

Your job is to take research findings and produce a polished, well-structured final output.

Writing guidelines:
- Clear, professional tone
- Structured with logical flow
- Specific facts, numbers, and citations
- No fluff or filler
- Markdown formatting allowed in the report itself

Output rules:
- Always respond in valid JSON format
- The "report" field contains the actual written content (can use markdown inside)
- The wrapper response is JSON, but report content is human-readable

Output format:
{
  "title": "concise descriptive title",
  "report": "the full written report in markdown format",
  "wordCount": 450,
  "sections": [
    "section name 1",
    "section name 2"
  ],
  "keyTakeaways": [
    "main point 1",
    "main point 2",
    "main point 3"
  ]
}`;
  }

  protected formatUserMessage(input: AgentInput): string {
    let message = `Original task: ${input.query}\n\n`;

    if (input.context) {
      if (input.context.findings) {
        message += `Research findings to incorporate:\n${JSON.stringify(input.context.findings, null, 2)}\n\n`;
      }

      if (input.context.plan) {
        message += `Original plan that was followed:\n${JSON.stringify(input.context.plan, null, 2)}\n\n`;
      }

      if (input.context.review) {
        message += `Critic feedback to address:\n${JSON.stringify(input.context.review, null, 2)}\n\n`;
      }

      if (input.context.chunks) {
        message += `Source documents available:\n`;
        for (const chunk of input.context.chunks.slice(0, 5)) {
          message += `- ${chunk.text}\n`;
        }
        message += `\n`;
      }
    }

    message += `Write a comprehensive, well-structured report that addresses the original task.`;

    return message;
  }
}
import { BaseAgent, AgentInput } from "./base.agent";

export class CriticAgent extends BaseAgent {
  constructor(providerOverride?: string) {
    super("Critic", providerOverride);
  }

  protected getSystemPrompt(): string {
    return `You are a Critic agent in a multi-agent AI system.

Your job is to review the work of other agents critically and identify issues, gaps, or improvements.

Be specific and constructive. Don't be vague.

Output rules:
- Always respond in valid JSON format only
- No markdown code blocks
- Identify both strengths and weaknesses
- Suggest concrete improvements
- Rate overall quality on a scale of 1-10

Output format:
{
  "strengths": [
    "specific strength"
  ],
  "weaknesses": [
    "specific weakness or gap"
  ],
  "suggestions": [
    "concrete improvement"
  ],
  "overallScore": 7.5,
  "verdict": "approve | revise | reject",
  "reasoning": "1-2 sentence explanation of the verdict"
}`;
  }

  protected formatUserMessage(input: AgentInput): string {
    let message = `Review the following work and provide critical feedback.\n\n`;

    if (input.context) {
      // Output from previous agent to be reviewed
      if (input.context.findings) {
        message += `Research findings to review:\n${JSON.stringify(input.context.findings, null, 2)}\n\n`;
      }

      if (input.context.plan) {
        message += `Plan to review:\n${JSON.stringify(input.context.plan, null, 2)}\n\n`;
      }

      if (input.context.draft) {
        message += `Draft to review:\n${input.context.draft}\n\n`;
      }

      if (input.context.summary) {
        message += `Summary to review:\n${input.context.summary}\n\n`;
      }
    }

    message += `Original task context: ${input.query}\n\n`;
    message += `Provide critical review with specific feedback.`;

    return message;
  }
}
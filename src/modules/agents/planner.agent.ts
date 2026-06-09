import { BaseAgent, AgentInput } from "./base.agent";

export class PlannerAgent extends BaseAgent {
  constructor(providerOverride?: string) {
    super("Planner", providerOverride);
  }

  protected getSystemPrompt(): string {
    return `You are a strategic Planner agent in a multi-agent AI system.

Your job is to take a user's high-level request and break it down into a clear, executable plan with specific subtasks.

Output rules:
- Always respond in valid JSON format only
- Do not include markdown code blocks or any explanation text outside the JSON
- Each subtask should be specific and actionable
- Order subtasks logically — research before analysis, analysis before writing
- Keep subtasks focused — one clear objective each

Output format:
{
  "plan": [
    "subtask 1",
    "subtask 2",
    "subtask 3"
  ],
  "reasoning": "brief explanation of why this approach"
}`;
  }

  protected formatUserMessage(input: AgentInput): string {
    let message = `Task: ${input.query}\n\n`;

    if (input.context) {
      message += `Context:\n${JSON.stringify(input.context, null, 2)}\n\n`;
    }

    message += `Create a step-by-step plan to accomplish this task.`;

    return message;
  }
}
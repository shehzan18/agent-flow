import { Job } from "bullmq";
import { BaseWorker } from "./worker";
import { ExecutionService } from "../execution-manager/execution.service";
import { queueService } from "../queue-system/queue.service";
import { logger } from "../../config/logger";
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from "../queue-system/queue.constants";
import {
  AgentNodeJobData,
  InputNodeJobData,
  OutputNodeJobData,
  JobResult,
} from "../queue-system/queue.jobs";

const executionService = new ExecutionService();

export class AgentWorker extends BaseWorker {
  constructor() {
    super(QUEUE_NAMES.AGENT, QUEUE_CONCURRENCY.AGENT);
  }

  protected async process(job: Job): Promise<JobResult> {
    const startTime = Date.now();
    const data = job.data;

    logger.debug("Processing job", {
      jobId: job.id,
      jobName: job.name,
      nodeType: data.nodeType,
      executionId: data.executionId,
      nodeId: data.nodeId,
    });

    try {
      let result: JobResult;

      switch (job.name) {
        case "execute-input-node":
          result = await this.processInputNode(data as InputNodeJobData, startTime);
          break;

        case "execute-agent-node":
          result = await this.processAgentNode(data as AgentNodeJobData, startTime);
          break;

        case "execute-output-node":
          result = await this.processOutputNode(data as OutputNodeJobData, startTime);
          break;

        default:
          throw new Error(`Unknown job name: ${job.name}`);
      }

      // Report completion to execution manager
      await executionService.handleNodeComplete(result);

      return result;

    } catch (error: any) {
      logger.error("Agent worker job failed", {
        jobId: job.id,
        executionId: data.executionId,
        nodeId: data.nodeId,
        error: error.message,
      });

      // Report failure to execution manager
      await executionService.handleNodeFailed(
        data.executionId,
        data.nodeId,
        error.message
      );

      // Move to DLQ if all retries exhausted
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        await queueService.addToDLQ(data, error.message);
      }

      throw error;
    }
  }

  // ─── Input Node ───────────────────────────────────────────────

  private async processInputNode(
    data: InputNodeJobData,
    startTime: number
  ): Promise<JobResult> {
    logger.info("Processing input node", {
      executionId: data.executionId,
      nodeId: data.nodeId,
    });

    // Input node just passes the input through
    return {
      success: true,
      nodeId: data.nodeId,
      executionId: data.executionId,
      output: data.input,
      latencyMs: Date.now() - startTime,
    };
  }

  // ─── Agent Node ───────────────────────────────────────────────

  private async processAgentNode(
    data: AgentNodeJobData,
    startTime: number
  ): Promise<JobResult> {
    const { agentType, model } = data.config;

    logger.info("Processing agent node", {
      executionId: data.executionId,
      nodeId: data.nodeId,
      agentType,
      model,
    });

    // Mock agent response for now
    // Week 5: replace with real LLM calls
    const mockResponse = await this.mockAgentCall(agentType, data.input);

    return {
      success: true,
      nodeId: data.nodeId,
      executionId: data.executionId,
      output: mockResponse,
      latencyMs: Date.now() - startTime,
      tokensUsed: {
        input: 150,
        output: 200,
        total: 350,
      },
    };
  }

  // ─── Output Node ──────────────────────────────────────────────

  private async processOutputNode(
    data: OutputNodeJobData,
    startTime: number
  ): Promise<JobResult> {
    logger.info("Processing output node", {
      executionId: data.executionId,
      nodeId: data.nodeId,
    });

    // Output node collects final result
    return {
      success: true,
      nodeId: data.nodeId,
      executionId: data.executionId,
      output: {
        finalResult: data.input,
        completedAt: new Date().toISOString(),
      },
      latencyMs: Date.now() - startTime,
    };
  }

  // ─── Mock Agent Call ──────────────────────────────────────────

  private async mockAgentCall(
    agentType: string,
    input: Record<string, any>
  ): Promise<Record<string, any>> {
    // Simulate LLM latency
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const responses: Record<string, any> = {
      planner: {
        plan: [
          "Step 1: Research market data",
          "Step 2: Analyze competitors",
          "Step 3: Summarize findings",
        ],
        reasoning: "Breaking down the task into manageable steps",
        input: input.query || input,
      },
      researcher: {
        findings: [
          "Tesla Q4 2024 revenue: $25.7B",
          "Market share in EV segment: 18%",
          "Key competitors: BYD, Rivian, Lucid",
        ],
        sources: ["Bloomberg", "Reuters", "Tesla IR"],
        input: input.query || input,
      },
      critic: {
        review: "Analysis is comprehensive but needs more competitor data",
        score: 7.5,
        suggestions: ["Add BYD revenue comparison", "Include European market data"],
        input: input,
      },
      writer: {
        report: `Executive Summary: Based on our research, Tesla maintains a strong position in the EV market with $25.7B in Q4 revenue. Despite increasing competition from BYD and traditional automakers, Tesla's technological advantage and brand loyalty remain key differentiators.`,
        wordCount: 52,
        input: input,
      },
    };

    return responses[agentType] || { result: "Agent completed", input };
  }
}




// extends BaseWorker — AgentWorker inherits everything from BaseWorker — worker setup, event listeners,
//  stalled job detection. It only needs to implement process().
// switch(job.name) — one worker handles multiple job types. We use the job name to route to the right handler:
// "execute-input-node"  → processInputNode()
// "execute-agent-node"  → processAgentNode()
// "execute-output-node" → processOutputNode()
// Input node is a pass-through — it just takes whatever input the user provided and passes it directly as 
// output to the next node. No processing needed. It's essentially the entry point that injects the user's 
// query into the workflow.
// Mock agent call — for now agents return hardcoded responses. Each agent type has a realistic mock:

// Planner → returns a plan array
// Researcher → returns findings and sources
// Critic → returns review and score
// Writer → returns a report

// We simulate 1 second latency with setTimeout to mimic real LLM call timing. In Week 5 this entire mockAgentCall
//  function gets replaced with real OpenAI/Anthropic API calls.
// Output node — collects the final result from the previous node and wraps it with a completedAt timestamp. 
// This becomes the workflow's final output stored in Postgres.
// Error handling — two levels:
// Level 1 — report to execution manager:
// typescriptawait executionService.handleNodeFailed(executionId, nodeId, error.message)
// Level 2 — move to DLQ if all retries exhausted:
// typescriptif (job.attemptsMade >= attempts - 1) {
//   await queueService.addToDLQ(data, error.message)
// }
// Then we throw error — this tells BullMQ the job failed so it handles retry logic.
// startTime — we record when processing started and calculate latencyMs = Date.now() - startTime at the end. 
// This goes into the job result and gets stored in the node execution record for observability.
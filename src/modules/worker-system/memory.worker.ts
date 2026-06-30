import { Job } from "bullmq";
import { BaseWorker } from "./worker";
import { ExecutionService } from "../execution-manager/execution.service";
import { queueService } from "../queue-system/queue.service";
import { logger } from "../../config/logger";
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from "../queue-system/queue.constants";
import { MemoryNodeJobData, JobResult } from "../queue-system/queue.jobs";

const executionService = new ExecutionService();

export class MemoryWorker extends BaseWorker {
  constructor() {
    super(QUEUE_NAMES.MEMORY, QUEUE_CONCURRENCY.MEMORY);
  }

  protected async process(job: Job): Promise<JobResult> {
    const startTime = Date.now();
    const data = job.data as MemoryNodeJobData;

    logger.debug("Processing memory job", {
      jobId: job.id,
      executionId: data.executionId,
      nodeId: data.nodeId,
      operation: data.config.operation,
    });

    try {
      const result = await this.processMemoryNode(data, startTime);

      await executionService.handleNodeComplete(result);

      return result;
    } catch (error: any) {
      logger.error("Memory worker job failed", {
        jobId: job.id,
        executionId: data.executionId,
        nodeId: data.nodeId,
        attempt: job.attemptsMade + 1,
        error: error.message,
      });

      const isFinalAttempt = job.attemptsMade >= (job.opts.attempts || 3) - 1;

      if (isFinalAttempt) {
        await executionService.handleNodeFailed(
          data.executionId,
          data.nodeId,
          error.message
        );
        await queueService.addToDLQ(data, error.message);
      }

      throw error;
    }
  }

  private async processMemoryNode(
    data: MemoryNodeJobData,
    startTime: number
  ): Promise<JobResult> {
    const { operation, memoryType = "episodic" } = data.config;

    logger.info("Processing memory node", {
      executionId: data.executionId,
      nodeId: data.nodeId,
      operation,
      memoryType,
    });

    if (operation === "read") {
      return this.readMemory(data, memoryType, startTime);
    } else {
      return this.writeMemory(data, memoryType, startTime);
    }
  }

  // ─── Read Memory ──────────────────────────────────────────────

  private async readMemory(
    data: MemoryNodeJobData,
    memoryType: string,
    startTime: number
  ): Promise<JobResult> {
    // Simulate memory retrieval latency
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Mock memory read
    // Week 6: replace with real Pinecone similarity search
    const memories = [
      {
        type: memoryType,
        content: "User previously worked on a market analysis for Tesla",
        relevanceScore: 0.92,
        createdAt: "2026-06-01T10:00:00Z",
      },
      {
        type: memoryType,
        content: "User prefers concise bullet point summaries",
        relevanceScore: 0.85,
        createdAt: "2026-05-28T14:00:00Z",
      },
    ];

    logger.info("Memory read complete", {
      executionId: data.executionId,
      memoriesFound: memories.length,
    });

    return {
      success: true,
      nodeId: data.nodeId,
      executionId: data.executionId,
      output: {
        operation: "read",
        memoryType,
        memories,
        memoryCount: memories.length,
        retrievedAt: new Date().toISOString(),
      },
      latencyMs: Date.now() - startTime,
    };
  }

  // ─── Write Memory ─────────────────────────────────────────────

  private async writeMemory(
    data: MemoryNodeJobData,
    memoryType: string,
    startTime: number
  ): Promise<JobResult> {
    // Simulate memory write latency
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Mock memory write
    // Week 6: replace with real Pinecone upsert + Postgres insert
    const memoryId = `mem_${Date.now()}`;

    logger.info("Memory write complete", {
      executionId: data.executionId,
      memoryId,
      memoryType,
    });

    return {
      success: true,
      nodeId: data.nodeId,
      executionId: data.executionId,
      output: {
        operation: "write",
        memoryType,
        memoryId,
        content: data.input,
        storedAt: new Date().toISOString(),
      },
      latencyMs: Date.now() - startTime,
    };
  }
}





// Explanation:
// Two operations — read and write:
// Read memory:
// Query comes in
//      ↓
// Search Pinecone for similar memories (mock for now)
//      ↓
// Return relevant memories as context
//      ↓
// Next agent uses these memories in its prompt
// Write memory:
// Agent output comes in
//      ↓
// Embed the content
//      ↓
// Store in Pinecone + Postgres
//      ↓
// Available for future workflow runs
// Why separate read and write? — they happen at different points in a workflow:

// Memory READ happens at the start — inject past context into agents
// Memory WRITE happens at the end — store what happened for future use

// memoryType — three types of memory we support:
// episodic    → what happened ("User ran Tesla analysis on June 4")
// preference  → what user likes ("User prefers bullet points")
// knowledge   → domain knowledge ("Tesla's main competitor is BYD")
// Each type gets stored and retrieved differently in Week 6.
// Mock memories are realistic — notice they have relevanceScore and createdAt.
//  This matches the real Pinecone response format so when we swap mock for real implementation, the
//   output structure stays the same. Nothing downstream breaks.


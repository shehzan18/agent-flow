import { RagService } from "../rag/rag.service";
import { Job } from "bullmq";
import { BaseWorker } from "./worker";
import { ExecutionService } from "../execution-manager/execution.service";
import { queueService } from "../queue-system/queue.service";
import { logger } from "../../config/logger";
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from "../queue-system/queue.constants";
import { RagNodeJobData, JobResult } from "../queue-system/queue.jobs";

const executionService = new ExecutionService();

export class RagWorker extends BaseWorker {
  private ragService = new RagService();
  constructor() {
    super(QUEUE_NAMES.RAG, QUEUE_CONCURRENCY.RAG);
  }

  protected async process(job: Job): Promise<JobResult> {
    const startTime = Date.now();
    const data = job.data as RagNodeJobData;

    logger.debug("Processing RAG job", {
      jobId: job.id,
      executionId: data.executionId,
      nodeId: data.nodeId,
      query: data.input.query,
    });

    try {
      const result = await this.processRagNode(data, startTime);

      // Report completion to execution manager
      await executionService.handleNodeComplete(result);

      return result;
    } catch (error: any) {
      logger.error("RAG worker job failed", {
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

  private async processRagNode(
  data: RagNodeJobData,
  startTime: number
): Promise<JobResult> {
  const { query } = data.input;
  const { topK = 5, threshold = 0.7 } = data.config;

  logger.info("Processing RAG node", {
    executionId: data.executionId,
    nodeId: data.nodeId,
    query,
    topK,
    threshold,
  });

  // Real RAG retrieval via Pinecone
  const results = await this.ragService.search({
    query,
    topK,
    minScore: threshold,
  });

  // Transform to format expected by downstream agents
  const chunks = results.map((r) => ({
    text: r.text,
    score: r.score,
    source: r.documentId,
    chunkId: r.chunkId,
  }));

  logger.info("RAG retrieval complete", {
    executionId: data.executionId,
    nodeId: data.nodeId,
    chunkCount: chunks.length,
    topScore: chunks[0]?.score,
  });

  return {
    success: true,
    nodeId: data.nodeId,
    executionId: data.executionId,
    output: {
      query,
      chunks,
      chunkCount: chunks.length,
      retrievedAt: new Date().toISOString(),
    },
    latencyMs: Date.now() - startTime,
  };
}
}


import { Job } from "bullmq";
import { BaseWorker } from "./worker";
import { ExecutionService } from "../execution-manager/execution.service";
import { queueService } from "../queue-system/queue.service";
import { logger } from "../../config/logger";
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from "../queue-system/queue.constants";
import { RagNodeJobData, JobResult } from "../queue-system/queue.jobs";

const executionService = new ExecutionService();

export class RagWorker extends BaseWorker {
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
        error: error.message,
      });

      await executionService.handleNodeFailed(
        data.executionId,
        data.nodeId,
        error.message
      );

      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
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

    // Mock RAG retrieval for now
    // Week 5: replace with real Pinecone search
    const chunks = await this.mockRagRetrieval(query, topK);

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

  private async mockRagRetrieval(
    query: string,
    topK: number
  ): Promise<Array<{ text: string; score: number; source: string }>> {
    // Simulate retrieval latency
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Mock relevant chunks
    return Array.from({ length: Math.min(topK, 3) }, (_, i) => ({
      text: `Relevant chunk ${i + 1} for query: "${query}". This contains important information about the topic.`,
      score: 0.95 - i * 0.05,
      source: `document_${i + 1}.pdf`,
    }));
  }
}



// Same pattern as agent worker — extends BaseWorker, implements process(), reports to execution manager. 
// The only difference is what happens inside processRagNode.
// RAG node takes a query from input — whatever text needs to be searched against the document store. 
// The query comes from the previous node's output — for example if a researcher agent ran before this,
//  its output might contain a specific question that needs document lookup.
// topK and threshold — two important RAG parameters:

// topK → how many chunks to retrieve. Default 5. More chunks = more context but higher token cost
// threshold → minimum similarity score to include a chunk. Default 0.7. Higher = more strict, fewer but
// more relevant results
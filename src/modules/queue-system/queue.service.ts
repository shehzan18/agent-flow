import { Queue, FlowProducer } from "bullmq";
import { redisConnection } from "../../config/redis";
import { logger } from "../../config/logger";
import {
  QUEUE_NAMES,
  JOB_NAMES,
  DEFAULT_JOB_OPTIONS,
} from "./queue.constants";
import {
  AgentNodeJobData,
  RagNodeJobData,
  MemoryNodeJobData,
  InputNodeJobData,
  OutputNodeJobData,
  ScheduleTriggerJobData,
} from "./queue.jobs";

class QueueService {
  // All queues
  private agentQueue: Queue;
  private ragQueue: Queue;
  private memoryQueue: Queue;
  private scheduleQueue: Queue;
  private dlq: Queue;

  // Flow producer for parent-child DAG jobs
  private flowProducer: FlowProducer;

  constructor() {
    const connection = redisConnection;

    // Create all queues
    this.agentQueue = new Queue(QUEUE_NAMES.AGENT, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });

    this.ragQueue = new Queue(QUEUE_NAMES.RAG, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });

    this.memoryQueue = new Queue(QUEUE_NAMES.MEMORY, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });

    this.scheduleQueue = new Queue(QUEUE_NAMES.SCHEDULE, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });

    this.dlq = new Queue(QUEUE_NAMES.DLQ, {
      connection,
    });

    // Flow producer for DAG execution
    this.flowProducer = new FlowProducer({ connection });

    logger.info("All queues initialized");
  }

  // ─── Add Jobs ─────────────────────────────────────────────────

  async addAgentJob(data: AgentNodeJobData) {
    const job = await this.agentQueue.add(
      JOB_NAMES.EXECUTE_AGENT_NODE,
      data,
      {
        jobId: `agent-${data.executionId}-${data.nodeId}`,
      }
    );

    logger.debug("Agent job added to queue", {
      jobId: job.id,
      executionId: data.executionId,
      nodeId: data.nodeId,
    });

    return job;
  }

  async addRagJob(data: RagNodeJobData) {
    const job = await this.ragQueue.add(
      JOB_NAMES.EXECUTE_RAG_NODE,
      data,
      {
        jobId: `rag-${data.executionId}-${data.nodeId}`,
      }
    );

    logger.debug("RAG job added to queue", {
      jobId: job.id,
      executionId: data.executionId,
      nodeId: data.nodeId,
    });

    return job;
  }

  async addMemoryJob(data: MemoryNodeJobData) {
    const job = await this.memoryQueue.add(
      JOB_NAMES.EXECUTE_MEMORY_NODE,
      data,
      {
        jobId: `memory-${data.executionId}-${data.nodeId}`,
      }
    );

    logger.debug("Memory job added to queue", {
      jobId: job.id,
      executionId: data.executionId,
      nodeId: data.nodeId,
    });

    return job;
  }

  async addInputJob(data: InputNodeJobData) {
    const job = await this.agentQueue.add(
      JOB_NAMES.EXECUTE_INPUT_NODE,
      data,
      {
        jobId: `input-${data.executionId}-${data.nodeId}`,
      }
    );

    logger.debug("Input job added to queue", {
      jobId: job.id,
      executionId: data.executionId,
      nodeId: data.nodeId,
    });

    return job;
  }

  async addOutputJob(data: OutputNodeJobData) {
    const job = await this.agentQueue.add(
      JOB_NAMES.EXECUTE_OUTPUT_NODE,
      data,
      {
        jobId: `output-${data.executionId}-${data.nodeId}`,
      }
    );

    logger.debug("Output job added to queue", {
      jobId: job.id,
      executionId: data.executionId,
      nodeId: data.nodeId,
    });

    return job;
  }

  async addScheduleJob(data: ScheduleTriggerJobData, delay?: number) {
    const job = await this.scheduleQueue.add(
      JOB_NAMES.TRIGGER_SCHEDULED_WORKFLOW,
      data,
      {
        jobId: `schedule-${data.scheduleId}-${Date.now()}`,
        delay,
      }
    );

    logger.debug("Schedule job added to queue", {
      jobId: job.id,
      scheduleId: data.scheduleId,
      delay,
    });

    return job;
  }

  async addToDLQ(originalJobData: any, error: string) {
    const job = await this.dlq.add(
      "failed-job",
      {
        originalData: originalJobData,
        error,
        failedAt: new Date().toISOString(),
      }
    );

    logger.warn("Job moved to DLQ", {
      jobId: job.id,
      error,
    });

    return job;
  }

  // ─── Queue Health ─────────────────────────────────────────────

  async getQueueStats() {
    const [
      agentWaiting,
      agentActive,
      agentFailed,
      ragWaiting,
      ragActive,
    ] = await Promise.all([
      this.agentQueue.getWaitingCount(),
      this.agentQueue.getActiveCount(),
      this.agentQueue.getFailedCount(),
      this.ragQueue.getWaitingCount(),
      this.ragQueue.getActiveCount(),
    ]);

    return {
      agent: {
        waiting: agentWaiting,
        active: agentActive,
        failed: agentFailed,
      },
      rag: {
        waiting: ragWaiting,
        active: ragActive,
      },
    };
  }

  // ─── Getters for Workers ──────────────────────────────────────

  getAgentQueue() { return this.agentQueue; }
  getRagQueue() { return this.ragQueue; }
  getMemoryQueue() { return this.memoryQueue; }
  getScheduleQueue() { return this.scheduleQueue; }
  getDLQ() { return this.dlq; }
  getFlowProducer() { return this.flowProducer; }

  // ─── Cleanup ──────────────────────────────────────────────────

  async closeAll() {
    await Promise.all([
      this.agentQueue.close(),
      this.ragQueue.close(),
      this.memoryQueue.close(),
      this.scheduleQueue.close(),
      this.dlq.close(),
      this.flowProducer.close(),
    ]);
    logger.info("All queues closed");
  }
}

// Export singleton instance
export const queueService = new QueueService();



import { Worker, Job, WorkerOptions } from "bullmq";
import { redisConnection } from "../../config/redis";
import { logger } from "../../config/logger";
import { QUEUE_CONCURRENCY } from "../queue-system/queue.constants";

export abstract class BaseWorker {
  protected worker: Worker;
  protected queueName: string;

  constructor(queueName: string, concurrency: number) {
    this.queueName = queueName;

    const workerOptions: WorkerOptions = {
      connection: redisConnection,
      concurrency,
      stalledInterval: 30000,  // check for stalled jobs every 30s
      maxStalledCount: 2,      // re-queue stalled jobs max 2 times
    };

    this.worker = new Worker(
      queueName,
      async (job: Job) => this.process(job),
      workerOptions
    );

    this.setupEventListeners();

    logger.info(`Worker started`, { queue: queueName, concurrency });
  }

  // Each worker must implement this
  protected abstract process(job: Job): Promise<any>;

  private setupEventListeners() {
    // Job completed successfully
    this.worker.on("completed", (job) => {
      logger.info("Job completed", {
        jobId: job.id,
        queue: this.queueName,
        duration: Date.now() - job.timestamp,
      });
    });

    // Job failed
    this.worker.on("failed", (job, error) => {
      logger.error("Job failed", {
        jobId: job?.id,
        queue: this.queueName,
        error: error.message,
        attemptsMade: job?.attemptsMade,
      });
    });

    // Job is stalled — picked up but no progress
    this.worker.on("stalled", (jobId) => {
      logger.warn("Job stalled — re-queuing", {
        jobId,
        queue: this.queueName,
      });
    });

    // Worker error
    this.worker.on("error", (error) => {
      logger.error("Worker error", {
        queue: this.queueName,
        error: error.message,
      });
    });
  }

  async close() {
    await this.worker.close();
    logger.info("Worker closed", { queue: this.queueName });
  }
}


// Base worker class with shared logic that all workers inherit from. 
// Sets up BullMQ worker configuration, error handling, stalled job detection, and lifecycle events.
//  Every specific worker (agent, RAG, memory) extends this class.


// abstract class — this class cannot be instantiated directly. You can only use it by extending it. 
// It forces every worker to implement the process method. If you forget to implement process in a child class
//  TypeScript gives you an error immediately.
// abstract process(job: Job): Promise<any> — this is the method every child worker must implement. The base 
// class calls it for every job but doesn't know what it does — that's the child's responsibility. This is the
//  Template Method pattern in software design.
// concurrency — how many jobs this worker processes simultaneously. We pass this from QUEUE_CONCURRENCY constants:

// Agent worker  → 5 concurrent jobs
// RAG worker    → 10 concurrent jobs
// Memory worker → 10 concurrent jobs
// stalledInterval: 30000 — every 30 seconds BullMQ checks if any active jobs haven't made progress.
//  If a worker crashed mid-job, this catches it and re-queues the job.
// maxStalledCount: 2 — a stalled job gets re-queued maximum 2 times. After that it goes to the failed state 
// and eventually DLQ. Prevents infinite re-queuing of a job that keeps crashing workers.
// Event listeners — four events:

// completed → job finished, log success with duration
// failed → job failed, log error with attempt count
// stalled → job frozen, log warning
// error → worker itself crashed, log critical error

// job.timestamp — BullMQ records when the job was created. Date.now() - job.timestamp gives us how long the 
// job took from creation to completion. This feeds into our observability layer later.
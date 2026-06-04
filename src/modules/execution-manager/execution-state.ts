import { redis } from "../../config/redis";
import { logger } from "../../config/logger";

// Redis key patterns
const EXECUTION_KEY = (executionId: string) =>
  `execution:${executionId}`;

const NODE_STATE_KEY = (executionId: string, nodeId: string) =>
  `execution:${executionId}:node:${nodeId}`;

const NODE_LOCK_KEY = (executionId: string, nodeId: string) =>
  `execution:${executionId}:node:${nodeId}:lock`;

// TTL — execution state lives in Redis for 24 hours
const EXECUTION_TTL = 60 * 60 * 24;

export type NodeStateValue =
  | "PENDING"
  | "READY"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED";

export class ExecutionStateManager {
  // ─── Execution State ──────────────────────────────────────────

  async initializeExecution(
    executionId: string,
    workflowId: string,
    nodeIds: string[]
  ) {
    const pipeline = redis.pipeline();

    // Store execution metadata
    pipeline.hset(EXECUTION_KEY(executionId), {
      executionId,
      workflowId,
      status: "RUNNING",
      startedAt: new Date().toISOString(),
      totalNodes: nodeIds.length,
      completedNodes: 0,
      failedNodes: 0,
    });

    pipeline.expire(EXECUTION_KEY(executionId), EXECUTION_TTL);

    // Initialize all node states as PENDING
    for (const nodeId of nodeIds) {
      pipeline.set(
        NODE_STATE_KEY(executionId, nodeId),
        "PENDING",
        "EX",
        EXECUTION_TTL
      );
    }

    await pipeline.exec();

    logger.debug("Execution state initialized in Redis", {
      executionId,
      nodeCount: nodeIds.length,
    });
  }

  async getExecutionStatus(executionId: string) {
    return redis.hgetall(EXECUTION_KEY(executionId));
  }

  async updateExecutionStatus(
    executionId: string,
    status: string,
    extra?: Record<string, string>
  ) {
    await redis.hset(EXECUTION_KEY(executionId), {
      status,
      ...extra,
    });
  }

  // ─── Node State ───────────────────────────────────────────────

  async getNodeState(
    executionId: string,
    nodeId: string
  ): Promise<NodeStateValue> {
    const state = await redis.get(NODE_STATE_KEY(executionId, nodeId));
    return (state as NodeStateValue) || "PENDING";
  }

  async setNodeState(
    executionId: string,
    nodeId: string,
    state: NodeStateValue
  ) {
    await redis.set(
      NODE_STATE_KEY(executionId, nodeId),
      state,
      "EX",
      EXECUTION_TTL
    );

    // Update counters
    if (state === "COMPLETED") {
      await redis.hincrby(EXECUTION_KEY(executionId), "completedNodes", 1);
    }
    if (state === "FAILED") {
      await redis.hincrby(EXECUTION_KEY(executionId), "failedNodes", 1);
    }

    logger.debug("Node state updated", { executionId, nodeId, state });
  }

  async getAllNodeStates(
    executionId: string,
    nodeIds: string[]
  ): Promise<Array<{ nodeId: string; state: NodeStateValue }>> {
    const pipeline = redis.pipeline();

    for (const nodeId of nodeIds) {
      pipeline.get(NODE_STATE_KEY(executionId, nodeId));
    }

    const results = await pipeline.exec();

    return nodeIds.map((nodeId, index) => ({
      nodeId,
      state: ((results?.[index]?.[1] as string) || "PENDING") as NodeStateValue,
    }));
  }

  // ─── Race Condition Prevention ────────────────────────────────

  async acquireNodeLock(
  executionId: string,
  nodeId: string
): Promise<boolean> {
  const result = await redis.set(
    NODE_LOCK_KEY(executionId, nodeId),
    "locked",
    "EX",
    30,
    "NX"
  );

  return result === "OK";
}

  async releaseNodeLock(executionId: string, nodeId: string) {
    await redis.del(NODE_LOCK_KEY(executionId, nodeId));
  }

  // ─── Cleanup ──────────────────────────────────────────────────

  async cleanupExecution(executionId: string, nodeIds: string[]) {
    const pipeline = redis.pipeline();

    pipeline.del(EXECUTION_KEY(executionId));

    for (const nodeId of nodeIds) {
      pipeline.del(NODE_STATE_KEY(executionId, nodeId));
      pipeline.del(NODE_LOCK_KEY(executionId, nodeId));
    }

    await pipeline.exec();

    logger.debug("Execution state cleaned up from Redis", { executionId });
  }
}

export const executionStateManager = new ExecutionStateManager();
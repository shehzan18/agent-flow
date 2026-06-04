import { ExecutionRepository } from "./execution.repository";
import { executionStateManager } from "./execution-state";
import { DAGService } from "../dag-engine/dag.service";
import { queueService } from "../queue-system/queue.service";
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { JobResult } from "../queue-system/queue.jobs";
import { NodeState, NodeExecutionState } from "../dag-engine/dependency-resolver";

const executionRepository = new ExecutionRepository();
const dagService = new DAGService();

export class ExecutionService {

  // ─── Trigger Workflow Execution ───────────────────────────────

  async triggerExecution(
    workflowId: string,
    userId: string,
    input: Record<string, any> = {}
  ) {
    // Step 1 — Load workflow with nodes and edges
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId, isActive: true },
      include: { nodes: true, edges: true },
    });

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    if (workflow.nodes.length === 0) {
      throw new Error("Workflow has no nodes");
    }

    // Step 2 — Validate graph and create execution plan
    const executionPlan = dagService.createExecutionPlan({
      nodes: workflow.nodes.map((n) => ({ id: n.id })),
      edges: workflow.edges.map((e) => ({ source: e.source, target: e.target })),
    });

    if (!executionPlan.isValid) {
      throw new Error(`Invalid workflow: ${executionPlan.error}`);
    }

    // Step 3 — Create execution record in Postgres
    const execution = await executionRepository.createWorkflowExecution({
      workflowId,
      userId,
      input,
    });

    // Step 4 — Create node execution records for all nodes
    await executionRepository.createNodeExecutions(
      execution.id,
      workflow.nodes.map((n) => ({
        nodeId: n.id,
        nodeName: n.name,
        nodeType: n.type,
      }))
    );

    // Step 5 — Initialize execution state in Redis
    await executionStateManager.initializeExecution(
      execution.id,
      workflowId,
      workflow.nodes.map((n) => n.id)
    );

    // Step 6 — Update execution status to RUNNING
    await executionRepository.updateExecutionStatus(
      execution.id,
      "RUNNING",
      { startedAt: new Date() }
    );

    // Step 7 — Push first ready nodes to queue
    // First level nodes (in-degree 0) are ready immediately
    const firstLevel = executionPlan.executionLevels[0];
    if (firstLevel) {
      for (const nodeId of firstLevel.nodeIds) {
        const node = workflow.nodes.find((n) => n.id === nodeId)!;

        await this.pushNodeToQueue({
          executionId: execution.id,
          workflowId,
          userId,
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type as string,
          nodeConfig: node.config as Record<string, any>,
          input,
        });

        // Mark node as READY in Redis
        await executionStateManager.setNodeState(
          execution.id,
          nodeId,
          "READY"
        );
      }
    }

    logger.info("Workflow execution triggered", {
      executionId: execution.id,
      workflowId,
      userId,
      totalNodes: workflow.nodes.length,
      firstLevelNodes: firstLevel?.nodeIds.length,
    });

    return {
      executionId: execution.id,
      status: "RUNNING",
      totalNodes: workflow.nodes.length,
      executionPlan,
    };
  }

  // ─── Handle Node Completion ───────────────────────────────────

  async handleNodeComplete(result: JobResult) {
    const { executionId, nodeId, output, latencyMs } = result;

    logger.debug("Handling node completion", { executionId, nodeId });

    // Acquire lock to prevent race condition
    const lockAcquired = await executionStateManager.acquireNodeLock(
      executionId,
      nodeId
    );

    if (!lockAcquired) {
      logger.warn("Could not acquire lock for node completion", {
        executionId,
        nodeId,
      });
      return;
    }

    try {
      // Update node state in Redis
      await executionStateManager.setNodeState(executionId, nodeId, "COMPLETED");

      // Update node execution in Postgres
      const nodeExecution = await executionRepository.findNodeExecution(
        executionId,
        nodeId
      );

      if (nodeExecution) {
        await executionRepository.updateNodeExecutionStatus(
          nodeExecution.id,
          "COMPLETED",
          {
            output: output || {},
            completedAt: new Date(),
            latencyMs,
          }
        );
      }

      // Load workflow to get edges and all nodes
      const execution = await executionRepository.findExecutionById(executionId);
      if (!execution) return;

      const workflow = await prisma.workflow.findUnique({
        where: { id: execution.workflowId },
        include: { nodes: true, edges: true },
      });

      if (!workflow) return;

      // Get current state of all nodes
      const allNodeStates = await executionStateManager.getAllNodeStates(
        executionId,
        workflow.nodes.map((n) => n.id)
      );

      // Convert to NodeState format for dependency resolver
      const nodeStates: NodeState[] = allNodeStates.map((ns) => ({
        nodeId: ns.nodeId,
        state: ns.state as NodeExecutionState,
      }));

      // Check if workflow is complete
      if (dagService.checkWorkflowComplete(nodeStates)) {
        await this.markWorkflowComplete(executionId, output);
        return;
      }

      // Check if workflow failed
      if (dagService.checkWorkflowFailed(nodeStates)) {
        await this.markWorkflowFailed(
          executionId,
          "One or more nodes failed"
        );
        return;
      }

      // Get next ready nodes
      const edges = workflow.edges.map((e) => ({
        source: e.source,
        target: e.target,
      }));

      const readyNodes = dagService.getNextReadyNodes(edges, nodeStates);

      // Push ready nodes to queue
      for (const readyNode of readyNodes) {
        const node = workflow.nodes.find((n) => n.id === readyNode.nodeId)!;

        // Mark as READY in Redis
        await executionStateManager.setNodeState(
          executionId,
          readyNode.nodeId,
          "READY"
        );

        // Push to appropriate queue
        await this.pushNodeToQueue({
          executionId,
          workflowId: workflow.id,
          userId: execution.userId,
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type as string,
          nodeConfig: node.config as Record<string, any>,
          input: output || {},
        });
      }

    } finally {
      // Always release lock
      await executionStateManager.releaseNodeLock(executionId, nodeId);
    }
  }

  // ─── Handle Node Failure ──────────────────────────────────────

  async handleNodeFailed(
    executionId: string,
    nodeId: string,
    error: string
  ) {
    logger.error("Node execution failed", { executionId, nodeId, error });

    // Update Redis state
    await executionStateManager.setNodeState(executionId, nodeId, "FAILED");

    // Update Postgres
    const nodeExecution = await executionRepository.findNodeExecution(
      executionId,
      nodeId
    );

    if (nodeExecution) {
      await executionRepository.updateNodeExecutionStatus(
        nodeExecution.id,
        "FAILED",
        {
          error,
          completedAt: new Date(),
        }
      );
    }

    // Mark workflow as failed
    await this.markWorkflowFailed(executionId, error);
  }

  // ─── Mark Workflow Complete ───────────────────────────────────

  private async markWorkflowComplete(
    executionId: string,
    output?: Record<string, any>
  ) {
    await executionRepository.updateExecutionStatus(
      executionId,
      "COMPLETED",
      {
        output: output || {},
        completedAt: new Date(),
      }
    );

    await executionStateManager.updateExecutionStatus(
      executionId,
      "COMPLETED",
      { completedAt: new Date().toISOString() }
    );

    logger.info("Workflow execution completed", { executionId });
  }

  // ─── Mark Workflow Failed ─────────────────────────────────────

  private async markWorkflowFailed(executionId: string, error: string) {
    await executionRepository.updateExecutionStatus(
      executionId,
      "FAILED",
      {
        error,
        completedAt: new Date(),
      }
    );

    await executionStateManager.updateExecutionStatus(
      executionId,
      "FAILED",
      { error }
    );

    logger.error("Workflow execution failed", { executionId, error });
  }

  // ─── Push Node To Queue ───────────────────────────────────────

  private async pushNodeToQueue(data: {
    executionId: string;
    workflowId: string;
    userId: string;
    nodeId: string;
    nodeName: string;
    nodeType: string;
    nodeConfig: Record<string, any>;
    input: Record<string, any>;
  }) {
    const base = {
      executionId: data.executionId,
      workflowId: data.workflowId,
      userId: data.userId,
      nodeId: data.nodeId,
      nodeName: data.nodeName,
    };

    switch (data.nodeType) {
      case "agent":
        await queueService.addAgentJob({
          ...base,
          nodeType: "agent",
          config: {
            agentType: data.nodeConfig.agentType || "researcher",
            model: data.nodeConfig.model,
            maxTokens: data.nodeConfig.maxTokens,
            systemPrompt: data.nodeConfig.systemPrompt,
          },
          input: data.input,
        });
        break;

      case "rag":
        await queueService.addRagJob({
          ...base,
          nodeType: "rag",
          config: {
            topK: data.nodeConfig.topK,
            threshold: data.nodeConfig.threshold,
            namespace: data.nodeConfig.namespace,
          },
          input: { query: data.input.query || "" },
        });
        break;

      case "memory":
        await queueService.addMemoryJob({
          ...base,
          nodeType: "memory",
          config: {
            operation: data.nodeConfig.operation || "read",
            memoryType: data.nodeConfig.memoryType,
          },
          input: data.input,
        });
        break;

      case "input":
        await queueService.addInputJob({
          ...base,
          nodeType: "input",
          input: data.input,
        });
        break;

      case "output":
      default:
        await queueService.addOutputJob({
          ...base,
          nodeType: "output",
          input: data.input,
        });
        break;
    }

    logger.debug("Node pushed to queue", {
      executionId: data.executionId,
      nodeId: data.nodeId,
      nodeType: data.nodeType,
    });
  }

  // ─── Get Execution Status ─────────────────────────────────────

  async getExecutionStatus(executionId: string, userId: string) {
    const execution = await executionRepository.findExecutionById(executionId);

    if (!execution || execution.userId !== userId) {
      throw new Error("Execution not found");
    }

    // Get live state from Redis if still running
    const liveState = await executionStateManager.getExecutionStatus(
      executionId
    );

    return {
      ...execution,
      liveState,
    };
  }

  async getWorkflowExecutions(workflowId: string, userId: string) {
    return executionRepository.findExecutionsByWorkflow(workflowId, userId);
  }
}
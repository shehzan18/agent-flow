import { prisma } from "../../config/database";

type ExecutionStatus = "PENDING" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED";
type NodeExecutionStatus = "PENDING" | "READY" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";

export class ExecutionRepository {
  async createWorkflowExecution(data: {
    workflowId: string;
    userId: string;
    input: Record<string, any>;
  }) {
    return prisma.workflowExecution.create({
      data: {
        workflowId: data.workflowId,
        userId: data.userId,
        input: data.input,
        status: "PENDING",
      },
    });
  }

  async findExecutionById(id: string) {
    return prisma.workflowExecution.findUnique({
      where: { id },
      include: {
        nodeExecutions: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  async findExecutionsByWorkflow(workflowId: string, userId: string) {
    return prisma.workflowExecution.findMany({
      where: { workflowId, userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        _count: {
          select: { nodeExecutions: true },
        },
      },
    });
  }

  async updateExecutionStatus(
    id: string,
    status: ExecutionStatus,
    data?: {
      output?: Record<string, any>;
      error?: string;
      startedAt?: Date;
      completedAt?: Date;
    }
  ) {
    return prisma.workflowExecution.update({
      where: { id },
      data: {
        status,
        ...data,
      },
    });
  }

  async createNodeExecutions(
    workflowExecutionId: string,
    nodes: Array<{
      nodeId: string;
      nodeName: string;
      nodeType: string;
    }>
  ) {
    return prisma.nodeExecution.createMany({
      data: nodes.map((node) => ({
        workflowExecutionId,
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        nodeType: node.nodeType,
        status: "PENDING" as const,
      })),
    });
  }

  async findNodeExecution(
    workflowExecutionId: string,
    nodeId: string
  ) {
    return prisma.nodeExecution.findFirst({
      where: { workflowExecutionId, nodeId },
    });
  }

  async findAllNodeExecutions(workflowExecutionId: string) {
    return prisma.nodeExecution.findMany({
      where: { workflowExecutionId },
      orderBy: { createdAt: "asc" },
    });
  }

  async updateNodeExecutionStatus(
    id: string,
    status: NodeExecutionStatus,
    data?: {
      input?: Record<string, any>;
      output?: Record<string, any>;
      error?: string;
      startedAt?: Date;
      completedAt?: Date;
      latencyMs?: number;
      retryCount?: number;
    }
  ) {
    return prisma.nodeExecution.update({
      where: { id },
      data: {
        status,
        ...data,
      },
    });
  }

  async createAgentMessage(data: {
    nodeExecutionId: string;
    role: string;
    content: string;
  }) {
    return prisma.agentMessage.create({ data });
  }
}
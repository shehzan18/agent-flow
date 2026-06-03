import { prisma } from "../../config/database";
import {
  CreateWorkflowInput,
  UpdateWorkflowInput,
  CreateNodeInput,
  CreateEdgeInput,
} from "./workflow.validation";

export class WorkflowRepository {
  // ─── Workflow CRUD ───────────────────────────────────────────

  async createWorkflow(userId: string, data: CreateWorkflowInput) {
    return prisma.workflow.create({
      data: {
        name: data.name,
        description: data.description,
        userId,
      },
      include: {
        nodes: true,
        edges: true,
      },
    });
  }

  async findWorkflowsByUserId(userId: string) {
    return prisma.workflow.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { nodes: true, edges: true },
        },
      },
    });
  }

  async findWorkflowById(id: string, userId: string) {
    return prisma.workflow.findFirst({
      where: {
        id,
        userId,
        isActive: true,
      },
      include: {
        nodes: true,
        edges: true,
      },
    });
  }

  async updateWorkflow(id: string, userId: string, data: UpdateWorkflowInput) {
    return prisma.workflow.update({
      where: { id },
      data,
      include: {
        nodes: true,
        edges: true,
      },
    });
  }

  async deleteWorkflow(id: string, userId: string) {
    return prisma.workflow.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async workflowBelongsToUser(id: string, userId: string): Promise<boolean> {
    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        userId,
        isActive: true,
      },
    });
    return !!workflow;
  }

  // ─── Node Operations ─────────────────────────────────────────

  async createNode(workflowId: string, data: CreateNodeInput) {
    return prisma.node.create({
      data: {
        workflowId,
        type: data.type,
        name: data.name,
        config: data.config as any,
        positionX: data.positionX,
        positionY: data.positionY,
      },
    });
  }

  async findNodeById(nodeId: string, workflowId: string) {
    return prisma.node.findFirst({
      where: {
        id: nodeId,
        workflowId,
      },
    });
  }

  async deleteNode(nodeId: string) {
    return prisma.node.delete({
      where: { id: nodeId },
    });
  }

  // ─── Edge Operations ─────────────────────────────────────────

  async createEdge(workflowId: string, data: CreateEdgeInput) {
    return prisma.edge.create({
      data: {
        workflowId,
        source: data.source,
        target: data.target,
      },
    });
  }

  async findEdgeById(edgeId: string, workflowId: string) {
    return prisma.edge.findFirst({
      where: {
        id: edgeId,
        workflowId,
      },
    });
  }

  async deleteEdge(edgeId: string) {
    return prisma.edge.delete({
      where: { id: edgeId },
    });
  }

  async edgeExists(
    workflowId: string,
    source: string,
    target: string
  ): Promise<boolean> {
    const edge = await prisma.edge.findFirst({
      where: {
        workflowId,
        source,
        target,
      },
    });
    return !!edge;
  }
}
import { WorkflowRepository } from "./workflow.repository";
import {
  CreateWorkflowInput,
  UpdateWorkflowInput,
  CreateNodeInput,
  CreateEdgeInput,
} from "./workflow.validation";
import { logger } from "../../config/logger";

const workflowRepository = new WorkflowRepository();

export class WorkflowService {
  // ─── Workflow Operations ──────────────────────────────────────

  async createWorkflow(userId: string, data: CreateWorkflowInput) {
    const workflow = await workflowRepository.createWorkflow(userId, data);

    logger.info("Workflow created", { workflowId: workflow.id, userId });

    return workflow;
  }

  async getUserWorkflows(userId: string) {
    const workflows = await workflowRepository.findWorkflowsByUserId(userId);
    return workflows;
  }

  async getWorkflowById(id: string, userId: string) {
    const workflow = await workflowRepository.findWorkflowById(id, userId);

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    return workflow;
  }

  async updateWorkflow(id: string, userId: string, data: UpdateWorkflowInput) {
    // Check ownership
    const belongs = await workflowRepository.workflowBelongsToUser(id, userId);
    if (!belongs) {
      throw new Error("Workflow not found");
    }

    const workflow = await workflowRepository.updateWorkflow(id, userId, data);

    logger.info("Workflow updated", { workflowId: id, userId });

    return workflow;
  }

  async deleteWorkflow(id: string, userId: string) {
    // Check ownership
    const belongs = await workflowRepository.workflowBelongsToUser(id, userId);
    if (!belongs) {
      throw new Error("Workflow not found");
    }

    await workflowRepository.deleteWorkflow(id, userId);

    logger.info("Workflow deleted", { workflowId: id, userId });
  }

  // ─── Node Operations ──────────────────────────────────────────

  async addNode(workflowId: string, userId: string, data: CreateNodeInput) {
    // Check ownership
    const belongs = await workflowRepository.workflowBelongsToUser(
      workflowId,
      userId
    );
    if (!belongs) {
      throw new Error("Workflow not found");
    }

    const node = await workflowRepository.createNode(workflowId, data);

    logger.info("Node added", { workflowId, nodeId: node.id, type: node.type });

    return node;
  }

  async removeNode(workflowId: string, nodeId: string, userId: string) {
    // Check ownership
    const belongs = await workflowRepository.workflowBelongsToUser(
      workflowId,
      userId
    );
    if (!belongs) {
      throw new Error("Workflow not found");
    }

    // Check node exists in this workflow
    const node = await workflowRepository.findNodeById(nodeId, workflowId);
    if (!node) {
      throw new Error("Node not found");
    }

    await workflowRepository.deleteNode(nodeId);

    logger.info("Node removed", { workflowId, nodeId });
  }

  // ─── Edge Operations ──────────────────────────────────────────

  async addEdge(workflowId: string, userId: string, data: CreateEdgeInput) {
    // Check ownership
    const belongs = await workflowRepository.workflowBelongsToUser(
      workflowId,
      userId
    );
    if (!belongs) {
      throw new Error("Workflow not found");
    }

    // Prevent self loop
    if (data.source === data.target) {
      throw new Error("A node cannot connect to itself");
    }

    // Check both nodes exist in this workflow
    const sourceNode = await workflowRepository.findNodeById(
      data.source,
      workflowId
    );
    if (!sourceNode) {
      throw new Error("Source node not found in this workflow");
    }

    const targetNode = await workflowRepository.findNodeById(
      data.target,
      workflowId
    );
    if (!targetNode) {
      throw new Error("Target node not found in this workflow");
    }

    // Prevent duplicate edges
    const exists = await workflowRepository.edgeExists(
      workflowId,
      data.source,
      data.target
    );
    if (exists) {
      throw new Error("Edge already exists between these nodes");
    }

    const edge = await workflowRepository.createEdge(workflowId, data);

    logger.info("Edge added", {
      workflowId,
      edgeId: edge.id,
      source: data.source,
      target: data.target,
    });

    return edge;
  }

  async removeEdge(workflowId: string, edgeId: string, userId: string) {
    // Check ownership
    const belongs = await workflowRepository.workflowBelongsToUser(
      workflowId,
      userId
    );
    if (!belongs) {
      throw new Error("Workflow not found");
    }

    // Check edge exists in this workflow
    const edge = await workflowRepository.findEdgeById(edgeId, workflowId);
    if (!edge) {
      throw new Error("Edge not found");
    }

    await workflowRepository.deleteEdge(edgeId);

    logger.info("Edge removed", { workflowId, edgeId });
  }
}


// Ownership check pattern — every single operation checks workflowBelongsToUser first. This is critical for 
// security. Without this, user A could send a request like DELETE /workflows/wf_xyz where wf_xyz belongs to
//  user B. The ownership check prevents this. Notice we always throw "Workflow not found" instead of "You don't
//   own this" — we don't want to tell attackers that the workflow exists but belongs to someone else.
// Self-loop prevention:
// typescriptif (data.source === data.target) {
//   throw new Error("A node cannot connect to itself")
// }
// Simple but important. A node pointing to itself would cause infinite execution. We catch it here before it
//  ever reaches the DAG engine.
// Node existence check before creating edge — before creating an edge between node A and node B, we verify both
//  nodes actually exist in this workflow. Someone could send valid UUIDs that belong to a completely different 
//  workflow. This check prevents cross-workflow edge injection.
// Why throw "Workflow not found" for both "doesn't exist" and "wrong owner"? — security through obscurity. If 
// you return "Access denied" an attacker knows the workflow ID is valid and belongs to someone else. Returning
//  the same message for both cases leaks no information.
import { Response } from "express";
import { WorkflowService } from "./workflow.service";
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  createNodeSchema,
  createEdgeSchema,
} from "./workflow.validation";
import { AuthRequest } from "../auth/auth.middleware";
import { logger } from "../../config/logger";

const workflowService = new WorkflowService();

export class WorkflowController {
  // ─── Workflow CRUD ────────────────────────────────────────────

  async createWorkflow(req: AuthRequest, res: Response) {
    try {
      const parsed = createWorkflowSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const workflow = await workflowService.createWorkflow(
        req.userId!,
        parsed.data
      );

      return res.status(201).json({
        success: true,
        message: "Workflow created successfully",
        data: { workflow },
      });
    } catch (error: any) {
      logger.error("Create workflow error", { error: error.message });
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async getUserWorkflows(req: AuthRequest, res: Response) {
    try {
      const workflows = await workflowService.getUserWorkflows(req.userId!);

      return res.status(200).json({
        success: true,
        data: { workflows },
      });
    } catch (error: any) {
      logger.error("Get workflows error", { error: error.message });
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async getWorkflowById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const workflow = await workflowService.getWorkflowById(id, req.userId!);

      return res.status(200).json({
        success: true,
        data: { workflow },
      });
    } catch (error: any) {
      logger.error("Get workflow error", { error: error.message });

      if (error.message === "Workflow not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async updateWorkflow(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const parsed = updateWorkflowSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const workflow = await workflowService.updateWorkflow(
        id,
        req.userId!,
        parsed.data
      );

      return res.status(200).json({
        success: true,
        message: "Workflow updated successfully",
        data: { workflow },
      });
    } catch (error: any) {
      logger.error("Update workflow error", { error: error.message });

      if (error.message === "Workflow not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async deleteWorkflow(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      await workflowService.deleteWorkflow(id, req.userId!);

      return res.status(200).json({
        success: true,
        message: "Workflow deleted successfully",
      });
    } catch (error: any) {
      logger.error("Delete workflow error", { error: error.message });

      if (error.message === "Workflow not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // ─── Node Operations ──────────────────────────────────────────

  async addNode(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const parsed = createNodeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const node = await workflowService.addNode(id, req.userId!, parsed.data);

      return res.status(201).json({
        success: true,
        message: "Node added successfully",
        data: { node },
      });
    } catch (error: any) {
      logger.error("Add node error", { error: error.message });

      if (error.message === "Workflow not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async removeNode(req: AuthRequest, res: Response) {
    try {
      const { id, nodeId } = req.params;

      await workflowService.removeNode(id, nodeId, req.userId!);

      return res.status(200).json({
        success: true,
        message: "Node removed successfully",
      });
    } catch (error: any) {
      logger.error("Remove node error", { error: error.message });

      if (
        error.message === "Workflow not found" ||
        error.message === "Node not found"
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // ─── Edge Operations ──────────────────────────────────────────

  async addEdge(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const parsed = createEdgeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const edge = await workflowService.addEdge(id, req.userId!, parsed.data);

      return res.status(201).json({
        success: true,
        message: "Edge added successfully",
        data: { edge },
      });
    } catch (error: any) {
      logger.error("Add edge error", { error: error.message });

      if (
        error.message === "Workflow not found" ||
        error.message === "Source node not found in this workflow" ||
        error.message === "Target node not found in this workflow"
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (
        error.message === "A node cannot connect to itself" ||
        error.message === "Edge already exists between these nodes"
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async removeEdge(req: AuthRequest, res: Response) {
    try {
      const { id, edgeId } = req.params;

      await workflowService.removeEdge(id, edgeId, req.userId!);

      return res.status(200).json({
        success: true,
        message: "Edge removed successfully",
      });
    } catch (error: any) {
      logger.error("Remove edge error", { error: error.message });

      if (
        error.message === "Workflow not found" ||
        error.message === "Edge not found"
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}



// "Workflow not found"     → 404
// "Node not found"         → 404
// "Self loop"              → 400
// "Duplicate edge"         → 400
// anything else            → 500
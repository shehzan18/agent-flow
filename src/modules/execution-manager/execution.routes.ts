import { Router, Response } from "express";
import { ExecutionService } from "./execution.service";
import { authenticate, AuthRequest } from "../auth/auth.middleware";
import { logger } from "../../config/logger";

const router = Router();
const executionService = new ExecutionService();

// All routes protected
router.use(authenticate);

// Trigger workflow execution
router.post(
  "/workflows/:id/execute",
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const input = req.body.input || {};

      const result = await executionService.triggerExecution(
        id,
        req.userId!,
        input
      );

      return res.status(202).json({
        success: true,
        message: "Workflow execution started",
        data: result,
      });
    } catch (error: any) {
      logger.error("Trigger execution error", { error: error.message });

      if (
        error.message === "Workflow not found" ||
        error.message === "Workflow has no nodes"
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.startsWith("Invalid workflow")) {
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
);

// Get execution status
router.get(
  "/executions/:executionId",
  async (req: AuthRequest, res: Response) => {
    try {
      const { executionId } = req.params;

      const execution = await executionService.getExecutionStatus(
        executionId,
        req.userId!
      );

      return res.status(200).json({
        success: true,
        data: { execution },
      });
    } catch (error: any) {
      logger.error("Get execution error", { error: error.message });

      if (error.message === "Execution not found") {
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
);

// Get all executions for a workflow
router.get(
  "/workflows/:id/executions",
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const executions = await executionService.getWorkflowExecutions(
        id,
        req.userId!
      );

      return res.status(200).json({
        success: true,
        data: { executions },
      });
    } catch (error: any) {
      logger.error("Get workflow executions error", { error: error.message });

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

export default router;
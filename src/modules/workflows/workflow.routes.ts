import { Router } from "express";
import { WorkflowController } from "./workflow.controller";
import { authenticate } from "../auth/auth.middleware";

const router = Router();
const workflowController = new WorkflowController();

// All routes protected
router.use(authenticate);

// Workflow CRUD
router.post("/workflows", (req, res) =>
  workflowController.createWorkflow(req as any, res)
);
router.get("/workflows", (req, res) =>
  workflowController.getUserWorkflows(req as any, res)
);
router.get("/workflows/:id", (req, res) =>
  workflowController.getWorkflowById(req as any, res)
);
router.put("/workflows/:id", (req, res) =>
  workflowController.updateWorkflow(req as any, res)
);
router.delete("/workflows/:id", (req, res) =>
  workflowController.deleteWorkflow(req as any, res)
);

// Node operations
router.post("/workflows/:id/nodes", (req, res) =>
  workflowController.addNode(req as any, res)
);
router.patch("/workflows/:id/nodes/:nodeId", (req, res) =>
  workflowController.updateNode(req as any, res)
);
router.delete("/workflows/:id/nodes/:nodeId", (req, res) =>
  workflowController.removeNode(req as any, res)
);

// Edge operations
router.post("/workflows/:id/edges", (req, res) =>
  workflowController.addEdge(req as any, res)
);
router.delete("/workflows/:id/edges/:edgeId", (req, res) =>
  workflowController.removeEdge(req as any, res)
);

export default router;
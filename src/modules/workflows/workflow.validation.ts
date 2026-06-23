import { z } from "zod";

export const createWorkflowSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const createNodeSchema = z.object({
  type: z.enum([
    "input",
    "output",
    "agent",
    "tool",
    "rag",
    "memory",
    "condition",
    "approval",
  ]),
  name: z.string().min(1, "Node name is required").max(100),
  config: z.record(z.string(), z.any()).optional().default({}),
  positionX: z.number().optional().default(0),
  positionY: z.number().optional().default(0),
});

export const updateNodeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.string(), z.any()).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

export type UpdateNodeInput = z.infer<typeof updateNodeSchema>;

export const createEdgeSchema = z.object({
  source: z.string().uuid("Source must be a valid node ID"),
  target: z.string().uuid("Target must be a valid node ID"),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;
export type CreateNodeInput = z.infer<typeof createNodeSchema>;
export type CreateEdgeInput = z.infer<typeof createEdgeSchema>;
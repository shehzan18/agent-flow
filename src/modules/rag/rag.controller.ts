import { Request, Response } from "express";
import { z } from "zod";
import { RagService } from "./rag.service";
import { AuthRequest } from "../auth/auth.middleware";
import { logger } from "../../config/logger";

const ragService = new RagService();

// Validation schemas
const searchSchema = z.object({
  query: z.string().min(1, "Query is required").max(2000),
  topK: z.number().int().min(1).max(50).optional(),
  minScore: z.number().min(0).max(1).optional(),
  documentIds: z.array(z.string().uuid()).optional(),
});

export class RagController {
  // POST /documents — upload a PDF
  async uploadDocument(req: AuthRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded. Use 'file' field name.",
        });
      }

      // Check file type
      if (req.file.mimetype !== "application/pdf") {
        return res.status(400).json({
          success: false,
          message: "Only PDF files are supported",
        });
      }

      // Process the document through full pipeline
      const result = await ragService.ingestDocument(req.file.path, {
        filename: req.file.filename,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: req.userId,
      });

      if (result.status === "FAILED") {
        return res.status(500).json({
          success: false,
          message: "Document processing failed",
          data: result,
        });
      }

      return res.status(201).json({
        success: true,
        message: "Document uploaded and processed successfully",
        data: result,
      });
    } catch (error: any) {
      logger.error("Document upload failed", { error: error.message });
      return res.status(500).json({
        success: false,
        message: error.message || "Document upload failed",
      });
    }
  }

  // POST /documents/search — query the knowledge base
  async searchDocuments(req: AuthRequest, res: Response) {
    try {
      const validated = searchSchema.parse(req.body);

      const results = await ragService.search(validated);

      return res.status(200).json({
        success: true,
        data: {
          query: validated.query,
          resultCount: results.length,
          results,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.issues,
        });
      }

      logger.error("Search failed", { error: error.message });
      return res.status(500).json({
        success: false,
        message: error.message || "Search failed",
      });
    }
  }

  // GET /documents/:id — get document info
  async getDocument(req: AuthRequest, res: Response) {
    try {
      const doc = await ragService.getDocument(req.params.id);

      if (!doc) {
        return res.status(404).json({
          success: false,
          message: "Document not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: { document: doc },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // GET /documents — list all documents
  async listDocuments(req: AuthRequest, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const mine = req.query.mine === "true";

      const docs = await ragService.listDocuments(
        mine ? req.userId : undefined,
        limit
      );

      return res.status(200).json({
        success: true,
        data: {
          count: docs.length,
          documents: docs,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // DELETE /documents/:id
  async deleteDocument(req: AuthRequest, res: Response) {
    try {
      await ragService.deleteDocument(req.params.id);

      return res.status(200).json({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (error: any) {
      if (error.message === "Document not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}
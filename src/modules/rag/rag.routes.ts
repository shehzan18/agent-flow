import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { RagController } from "./rag.controller";
import { authenticate } from "../auth/auth.middleware";

const router = Router();
const ragController = new RagController();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp_originalname
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${timestamp}_${sanitized}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// All RAG routes require authentication
router.use(authenticate);

// Upload a document
router.post("/documents", upload.single("file"), (req, res) =>
  ragController.uploadDocument(req, res)
);

// Search the knowledge base
router.post("/documents/search", (req, res) =>
  ragController.searchDocuments(req, res)
);

// List all documents
router.get("/documents", (req, res) => ragController.listDocuments(req, res));

// Get one document by ID
router.get("/documents/:id", (req, res) => ragController.getDocument(req, res));

// Delete a document
router.delete("/documents/:id", (req, res) =>
  ragController.deleteDocument(req, res)
);

export default router;
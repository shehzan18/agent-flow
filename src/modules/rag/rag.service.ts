import fs from "fs/promises";
import { PdfExtractor } from "./pdf-extractor";
import { Chunker } from "./chunker";
import { Embedder } from "./embedder";
import { VectorStore } from "./vector-store";
import { DocumentRepository, CreateDocumentInput } from "./document.repository";
import { SearchRequest, SearchResult, UploadResult } from "./rag.types";
import { logger } from "../../config/logger";

export class RagService {
  private pdfExtractor: PdfExtractor;
  private chunker: Chunker;
  private embedder: Embedder;
  private vectorStore: VectorStore;
  private documentRepo: DocumentRepository;

  constructor() {
    this.pdfExtractor = new PdfExtractor();
    this.chunker = new Chunker();
    this.embedder = new Embedder();
    this.vectorStore = new VectorStore();
    this.documentRepo = new DocumentRepository();
  }

  // Full ingestion pipeline — extract, chunk, embed, store
  async ingestDocument(
    filePath: string,
    metadata: CreateDocumentInput
  ): Promise<UploadResult> {
    // Step 1: Create database record
    const doc = await this.documentRepo.create(metadata);

    logger.info("Document ingestion started", {
      documentId: doc.id,
      filename: metadata.originalName,
    });

    try {
      // Step 2: Mark as processing
      await this.documentRepo.updateStatus(doc.id, "PROCESSING");

      // Step 3: Extract text from PDF
      const extracted = await this.pdfExtractor.extractFromFile(filePath);

      if (!extracted.text || extracted.text.trim().length === 0) {
        throw new Error("No text could be extracted from this PDF");
      }

      // Step 4: Chunk the text
      const chunks = this.chunker.chunk(doc.id, extracted.text);

      if (chunks.length === 0) {
        throw new Error("No chunks were created from the document");
      }

      // Step 5: Generate embeddings
      const embeddedChunks = await this.embedder.embedChunks(chunks);

      // Step 6: Store in Pinecone
      await this.vectorStore.upsertChunks(embeddedChunks);

      // Step 7: Mark as completed
      await this.documentRepo.updateStatus(doc.id, "COMPLETED", {
        chunkCount: chunks.length,
      });

      // Step 8: Clean up the uploaded file
      await this.cleanupFile(filePath);

      logger.info("Document ingestion complete", {
        documentId: doc.id,
        chunkCount: chunks.length,
        pageCount: extracted.pageCount,
      });

      return {
        documentId: doc.id,
        filename: metadata.originalName,
        status: "COMPLETED",
      };
    } catch (error: any) {
      logger.error("Document ingestion failed", {
        documentId: doc.id,
        error: error.message,
      });

      await this.documentRepo.updateStatus(doc.id, "FAILED", {
        error: error.message,
      });

      // Still try to clean up the file
      await this.cleanupFile(filePath).catch(() => {});

      return {
        documentId: doc.id,
        filename: metadata.originalName,
        status: "FAILED",
      };
    }
  }

  // Search the knowledge base
  async search(request: SearchRequest): Promise<SearchResult[]> {
    logger.info("RAG search request", {
      query: request.query.substring(0, 100),
      topK: request.topK,
    });

    // Step 1: Embed the query
    const queryEmbedded = await this.embedder.embedQuery(request.query);

    // Step 2: Search Pinecone
    const results = await this.vectorStore.search(
      queryEmbedded.embedding,
      request.topK ?? 5,
      request.documentIds
    );

    // Step 3: Apply minimum score filter if provided
    const filtered = request.minScore
      ? results.filter((r) => r.score >= request.minScore!)
      : results;

    logger.info("RAG search complete", {
      resultCount: filtered.length,
      topScore: filtered[0]?.score,
    });

    return filtered;
  }

  // Get document info
  async getDocument(documentId: string) {
    return this.documentRepo.findById(documentId);
  }

  // List documents
  async listDocuments(uploadedBy?: string, limit: number = 20) {
    return this.documentRepo.findAll(uploadedBy, limit);
  }

  // Delete a document and its chunks
  async deleteDocument(documentId: string): Promise<void> {
    const doc = await this.documentRepo.findById(documentId);
    if (!doc) {
      throw new Error("Document not found");
    }

    // Delete from Pinecone first
    await this.vectorStore.deleteByDocumentId(documentId);

    // Then delete the database record
    await this.documentRepo.delete(documentId);

    logger.info("Document deleted", { documentId });
  }

  private async cleanupFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.debug("Cleaned up uploaded file", { filePath });
    } catch (error) {
      logger.warn("Failed to clean up file", { filePath, error });
    }
  }
}
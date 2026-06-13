import { prisma } from "../../config/database";
import { logger } from "../../config/logger";

export type DocumentStatusValue = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface CreateDocumentInput {
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy?: string;
}

export class DocumentRepository {
  async create(input: CreateDocumentInput) {
    const doc = await prisma.document.create({
      data: {
        filename: input.filename,
        originalName: input.originalName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        uploadedBy: input.uploadedBy,
        status: "PENDING",
        chunkCount: 0,
      },
    });

    logger.debug("Document record created", { documentId: doc.id });
    return doc;
  }

  async findById(documentId: string) {
    return prisma.document.findUnique({
      where: { id: documentId },
    });
  }

  async findAll(uploadedBy?: string, limit: number = 20) {
    return prisma.document.findMany({
      where: uploadedBy ? { uploadedBy } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async updateStatus(
    documentId: string,
    status: DocumentStatusValue,
    extra?: { chunkCount?: number; error?: string }
  ) {
    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        status,
        ...(extra?.chunkCount !== undefined && { chunkCount: extra.chunkCount }),
        ...(extra?.error !== undefined && { error: extra.error }),
      },
    });

    logger.debug("Document status updated", { documentId, status });
    return updated;
  }

  async delete(documentId: string) {
    await prisma.document.delete({
      where: { id: documentId },
    });

    logger.debug("Document record deleted", { documentId });
  }
}
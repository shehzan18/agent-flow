import { Pinecone, Index } from "@pinecone-database/pinecone";
import { EmbeddedChunk, SearchResult } from "./rag.types";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

export class VectorStore {
  private client: Pinecone;
  private index: Index;
  private indexName: string;

  constructor() {
    if (!env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY is required");
    }

    if (!env.PINECONE_INDEX_NAME) {
      throw new Error("PINECONE_INDEX_NAME is required");
    }

    this.client = new Pinecone({
      apiKey: env.PINECONE_API_KEY,
    });

    this.indexName = env.PINECONE_INDEX_NAME;
    this.index = this.client.index(this.indexName);

    logger.info("Pinecone vector store initialized", {
      index: this.indexName,
    });
  }

  // Upload embedded chunks to Pinecone
  async upsertChunks(chunks: EmbeddedChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    logger.info("Upserting chunks to Pinecone", {
      count: chunks.length,
    });

    // Pinecone expects this format
    const vectors = chunks.map((chunk) => ({
      id: chunk.id,
      values: chunk.embedding,
      metadata: {
        documentId: chunk.documentId,
        text: chunk.text,
        index: chunk.index,
        provider: chunk.embeddingProvider,
        model: chunk.embeddingModel,
        ...(chunk.metadata || {}),
      },
    }));

    // Pinecone recommends batches of 100 max for upsert
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await this.index.upsert({ records: batch } as any);

      logger.debug("Upserted batch to Pinecone", {
        batchNumber: Math.floor(i / batchSize) + 1,
        size: batch.length,
      });
    }

    logger.info("All chunks upserted to Pinecone", {
      total: vectors.length,
    });
  }

  // Search for similar vectors
  async search(
    queryEmbedding: number[],
    topK: number = 5,
    documentIds?: string[]
  ): Promise<SearchResult[]> {
    logger.debug("Searching Pinecone", {
      topK,
      documentFilter: documentIds?.length || "none",
    });

    // Build filter to restrict search to specific documents if provided
    const filter = documentIds && documentIds.length > 0
      ? { documentId: { $in: documentIds } }
      : undefined;

    const response = await this.index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter,
    });

    const results: SearchResult[] = (response.matches || []).map((match) => ({
      chunkId: match.id,
      documentId: (match.metadata?.documentId as string) || "",
      text: (match.metadata?.text as string) || "",
      score: match.score || 0,
      metadata: match.metadata as Record<string, any>,
    }));

    logger.info("Pinecone search complete", {
      resultCount: results.length,
      topScore: results[0]?.score,
    });

    return results;
  }

  // Delete all chunks for a document (when document is removed)
  async deleteByDocumentId(documentId: string): Promise<void> {
    logger.info("Deleting chunks from Pinecone", { documentId });

    // Pinecone delete by metadata filter
    await this.index.deleteMany({
      filter: { documentId: { $eq: documentId } },
    });

    logger.info("Deleted chunks for document", { documentId });
  }

  // Get stats about the index
  async getStats(): Promise<{ totalVectors: number; dimension: number }> {
    const stats = await this.index.describeIndexStats();
    return {
      totalVectors: stats.totalRecordCount || 0,
      dimension: stats.dimension || 0,
    };
  }
}
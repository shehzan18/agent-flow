import { Pinecone, Index } from "@pinecone-database/pinecone";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

export interface MemoryVector {
  id: string;
  embedding: number[];
  metadata: {
    content: string;
    importance: number;
    userId: string;
    createdAt: string;
  };
}

export interface MemorySearchResult {
  id: string;
  score: number;          // cosine similarity from Pinecone
  metadata: Record<string, any>;
}

export class MemoryStore {
  private client: Pinecone;
  private index: Index;

  constructor() {
    if (!env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY is required for memory store");
    }
    if (!env.PINECONE_INDEX_NAME) {
      throw new Error("PINECONE_INDEX_NAME is required for memory store");
    }

    this.client = new Pinecone({ apiKey: env.PINECONE_API_KEY });
    this.index = this.client.index(env.PINECONE_INDEX_NAME);

    logger.info("Memory store initialized", {
      index: env.PINECONE_INDEX_NAME,
    });
  }

  // Build the namespace string for a user — keeps each user's memories isolated
  private getNamespace(userId: string): string {
    return `memory_${userId}`;
  }

  // Store a memory vector in Pinecone
  async upsert(vector: MemoryVector): Promise<void> {
    const namespace = this.getNamespace(vector.metadata.userId);

    if (!vector.embedding || vector.embedding.length === 0) {
        throw new Error(`Cannot upsert memory ${vector.id}: embedding is empty`);
    }

    const record = {
        id: vector.id,
        values: vector.embedding,
        metadata: {
        content: vector.metadata.content,
        importance: vector.metadata.importance,
        userId: vector.metadata.userId,
        createdAt: vector.metadata.createdAt,
        },
    };

    await this.index.namespace(namespace).upsert({ records: [record] } as any);

    logger.debug("Memory vector upserted", {
        memoryId: vector.id,
        namespace,
        dims: vector.embedding.length,
    });
    }

  // Search for similar memories within a user's namespace
  async search(
    queryEmbedding: number[],
    userId: string,
    topK: number = 10
  ): Promise<MemorySearchResult[]> {
    const namespace = this.getNamespace(userId);

    const response = await this.index.namespace(namespace).query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    const results: MemorySearchResult[] = (response.matches || []).map((m) => ({
      id: m.id,
      score: m.score || 0,
      metadata: m.metadata || {},
    }));

    logger.debug("Memory search complete", {
      namespace,
      resultCount: results.length,
      topScore: results[0]?.score,
    });

    return results;
  }

  // Delete a memory vector (used during merge cleanup)
  async delete(memoryId: string, userId: string): Promise<void> {
    const namespace = this.getNamespace(userId);
    await this.index.namespace(namespace).deleteMany([memoryId]);

    logger.debug("Memory vector deleted", { memoryId, namespace });
    }

  // Delete multiple memory vectors (batch)
  async deleteMany(memoryIds: string[], userId: string): Promise<void> {
    if (memoryIds.length === 0) return;

    const namespace = this.getNamespace(userId);
    await this.index.namespace(namespace).deleteMany(memoryIds);

    logger.debug("Memory vectors deleted", {
      count: memoryIds.length,
      namespace,
    });
  }
}
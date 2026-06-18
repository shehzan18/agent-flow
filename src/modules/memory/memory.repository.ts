import { prisma } from "../../config/database";
import { logger } from "../../config/logger";

export interface CreateMemoryInput {
  id: string;                  // UUID we generate (matches Pinecone vector ID)
  content: string;
  importance: number;
  userId: string;
  embeddingProvider: string;
  embeddingModel: string;
}

export class MemoryRepository {
  // Create a new memory
  async create(input: CreateMemoryInput) {
    const memory = await prisma.memory.create({
      data: {
        id: input.id,
        content: input.content,
        importance: input.importance,
        userId: input.userId,
        embeddingProvider: input.embeddingProvider,
        embeddingModel: input.embeddingModel,
      },
    });
    logger.debug("Memory created", { memoryId: memory.id, userId: input.userId });
    return memory;
  }

  // Find one memory by ID
  async findById(memoryId: string) {
    return prisma.memory.findUnique({
      where: { id: memoryId },
    });
  }

  // Find many memories by IDs (used after Pinecone search)
  async findByIds(memoryIds: string[]) {
    if (memoryIds.length === 0) return [];
    return prisma.memory.findMany({
      where: { id: { in: memoryIds } },
    });
  }

  // List all memories for a user
  async findByUserId(userId: string, limit: number = 50) {
    return prisma.memory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  // Update content (used during merge consolidation)
  async updateContent(memoryId: string, content: string, importance?: number) {
    const memory = await prisma.memory.update({
      where: { id: memoryId },
      data: {
        content,
        ...(importance !== undefined && { importance }),
      },
    });
    logger.debug("Memory content updated", { memoryId });
    return memory;
  }

  // Bump access count + lastAccessedAt (called when memory is recalled)
  async markAccessed(memoryIds: string[]) {
    if (memoryIds.length === 0) return;
    await prisma.memory.updateMany({
      where: { id: { in: memoryIds } },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });
    logger.debug("Memories marked as accessed", { count: memoryIds.length });
  }

  // Delete a memory (used during merge — old memories get deleted after merging)
  async delete(memoryId: string) {
    await prisma.memory.delete({
      where: { id: memoryId },
    });
    logger.debug("Memory deleted", { memoryId });
  }

  // Delete multiple memories (batch delete during merge)
  async deleteMany(memoryIds: string[]) {
    if (memoryIds.length === 0) return;
    await prisma.memory.deleteMany({
      where: { id: { in: memoryIds } },
    });
    logger.debug("Memories deleted", { count: memoryIds.length });
  }

  // Count memories for a user (useful for analytics / debugging)
  async countByUserId(userId: string) {
    return prisma.memory.count({ where: { userId } });
  }
}
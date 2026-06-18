import { MemorySearchResult } from "./memory-store";
import { MemoryRecord } from "./memory.types";
import { ScoredMemory } from "./memory.types";
import { logger } from "../../config/logger";

export interface ScoringWeights {
  similarity: number;
  recency: number;
  importance: number;
}

export class MemoryScorer {
  // Default weights — similarity matters most, then importance, then recency
  private readonly DEFAULT_WEIGHTS: ScoringWeights = {
    similarity: 0.5,
    recency: 0.2,
    importance: 0.3,
  };

  // Decay rate for recency — controls how fast old memories fade
  // Higher = faster decay. 0.01 means a memory loses ~63% relevance after 100 hours
  private readonly DECAY_RATE = 0.01;

  // Combine Pinecone search results with Postgres records and compute blended scores
  score(
    searchResults: MemorySearchResult[],
    records: MemoryRecord[],
    weights?: Partial<ScoringWeights>
  ): ScoredMemory[] {
    const w = { ...this.DEFAULT_WEIGHTS, ...weights };

    // Build a lookup map: memoryId -> Postgres record
    const recordMap = new Map(records.map((r) => [r.id, r]));

    const now = Date.now();

    const scored: ScoredMemory[] = [];

    for (const result of searchResults) {
      const record = recordMap.get(result.id);
      if (!record) {
        // Vector exists in Pinecone but not Postgres — skip (shouldn't happen)
        logger.warn("Memory vector has no matching Postgres record", {
          memoryId: result.id,
        });
        continue;
      }

      // 1. Similarity score (already 0-1 from Pinecone)
      const similarity = result.score;

      // 2. Recency score — exponential decay based on hours since last access
      const hoursSinceAccess =
        (now - new Date(record.lastAccessedAt).getTime()) / (1000 * 60 * 60);
      const recency = Math.exp(-this.DECAY_RATE * hoursSinceAccess);

      // 3. Importance score — normalize 1-10 to 0-1
      const importance = record.importance / 10;

      // Weighted blend
      const final =
        w.similarity * similarity +
        w.recency * recency +
        w.importance * importance;

      scored.push({
        id: record.id,
        content: record.content,
        importance: record.importance,
        createdAt: record.createdAt,
        lastAccessedAt: record.lastAccessedAt,
        accessCount: record.accessCount,
        scores: {
          similarity,
          recency,
          importance,
          final,
        },
      });
    }

    // Sort by final score, highest first
    scored.sort((a, b) => b.scores.final - a.scores.final);

    return scored;
  }

  // Filter to those above a minimum final score, then take top K
  selectTop(
    scored: ScoredMemory[],
    topK: number,
    minScore?: number
  ): ScoredMemory[] {
    let filtered = scored;
    if (minScore !== undefined) {
      filtered = scored.filter((m) => m.scores.final >= minScore);
    }
    return filtered.slice(0, topK);
  }
}
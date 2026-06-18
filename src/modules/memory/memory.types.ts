// Base memory record — what's stored
export interface MemoryRecord {
  id: string;
  content: string;
  importance: number;
  userId: string;
  accessCount: number;
  embeddingProvider: string;
  embeddingModel: string;
  createdAt: Date;
  lastAccessedAt: Date;
  updatedAt: Date;
}

// What the agent provides when saving a memory
export interface SaveMemoryInput {
  content: string;
  importance?: number;
  userId: string;
}

// Query to recall memories
export interface RecallMemoryQuery {
  query: string;
  userId: string;
  topK?: number;
  minScore?: number;
}

// A memory returned from search, with the full blended score
export interface ScoredMemory {
  id: string;
  content: string;
  importance: number;
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
  scores: {
    similarity: number;       // 0-1, cosine from Pinecone
    recency: number;          // 0-1, exponential decay
    importance: number;       // 0-1, normalized importance/10
    final: number;            // 0-1, weighted blend
  };
}

// The 3 possible outcomes of a save operation
export type SaveOutcome = "created" | "updated" | "merged";

// Result returned after saving
export interface SaveMemoryResult {
  memoryId: string;
  outcome: SaveOutcome;
  content: string;            // final content (may differ from input if merged)
} 
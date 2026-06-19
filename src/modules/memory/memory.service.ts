import { v4 as uuidv4 } from "uuid";
import {
  getCompletionProvider,
  getEmbeddingProvider,
} from "../../infrastructure/llm/llm.factory";
import { MemoryRepository } from "./memory.repository";
import { MemoryStore } from "./memory-store";
import { MemoryScorer } from "./memory-scorer";
import {
  SaveMemoryInput,
  SaveMemoryResult,
  RecallMemoryQuery,
  ScoredMemory,
  MemoryRecord,
} from "./memory.types";
import { logger } from "../../config/logger";

export class MemoryService {
  private repo: MemoryRepository;
  private store: MemoryStore;
  private scorer: MemoryScorer;

  // Similarity thresholds that decide write behavior
  private readonly UPDATE_THRESHOLD = 0.92; // near-identical → update in place
  private readonly MERGE_THRESHOLD = 0.85; // related → merge via LLM

  constructor() {
    this.repo = new MemoryRepository();
    this.store = new MemoryStore();
    this.scorer = new MemoryScorer();
  }

  // ---------- SAVE ----------
  async save(input: SaveMemoryInput): Promise<SaveMemoryResult> {
    const importance = input.importance ?? 5;
    const userId = input.userId;

    logger.info("Saving memory", {
      userId,
      importance,
      contentPreview: input.content.substring(0, 80),
    });

    const embedder = getEmbeddingProvider();
    const providerName = embedder.getProviderName();

    // Embed the new memory content
    const embedding = await embedder.embed(input.content);

    // Search for similar existing memories
    const searchResults = await this.store.search(embedding, userId, 5);
    const topMatch = searchResults[0];

    // Only consult the LLM if there's a plausibly-related neighbor
    const CANDIDATE_FLOOR = 0.65;

    if (topMatch && topMatch.score >= CANDIDATE_FLOOR) {
      const existing = await this.repo.findById(topMatch.id);

      if (existing) {
        const relationship = await this.classifyRelationship(
          existing.content,
          input.content
        );

        logger.info("Memory relationship classified", {
          relationship,
          similarity: topMatch.score,
          existingId: topMatch.id,
        });

        if (relationship === "same") {
          return this.handleUpdate(topMatch.id, input, importance);
        }

        if (relationship === "related") {
          return this.handleMerge(
            topMatch.id,
            input,
            importance,
            embedding,
            providerName
          );
        }
        // "distinct" falls through to create
      }
    }

    // Create a brand new memory
    return this.handleCreate(input, importance, embedding, providerName);
  }

  // CREATE — store as a new memory
  private async handleCreate(
    input: SaveMemoryInput,
    importance: number,
    embedding: number[],
    providerName: string
  ): Promise<SaveMemoryResult> {
    const id = uuidv4();

    await this.repo.create({
      id,
      content: input.content,
      importance,
      userId: input.userId,
      embeddingProvider: providerName,
      embeddingModel: "gemini-embedding-001",
    });

    await this.store.upsert({
      id,
      embedding,
      metadata: {
        content: input.content,
        importance,
        userId: input.userId,
        createdAt: new Date().toISOString(),
      },
    });

    logger.info("Memory created", { memoryId: id });

    return { memoryId: id, outcome: "created", content: input.content };
  }

  // UPDATE — overwrite a near-identical existing memory (conflict resolution)
  private async handleUpdate(
    existingId: string,
    input: SaveMemoryInput,
    importance: number
  ): Promise<SaveMemoryResult> {
    // The new info supersedes the old. Replace content, keep higher importance.
    const existing = await this.repo.findById(existingId);
    const newImportance = Math.max(importance, existing?.importance ?? 0);

    await this.repo.updateContent(existingId, input.content, newImportance);

    // Update the Pinecone metadata too (re-embed since content changed)
    const embedder = getEmbeddingProvider();
    const embedding = await embedder.embed(input.content);
    await this.store.upsert({
      id: existingId,
      embedding,
      metadata: {
        content: input.content,
        importance: newImportance,
        userId: input.userId,
        createdAt: new Date().toISOString(),
      },
    });

    logger.info("Memory updated (conflict resolution)", { memoryId: existingId });

    return { memoryId: existingId, outcome: "updated", content: input.content };
  }

  // MERGE — combine new info with a related existing memory (consolidation)
  private async handleMerge(
    existingId: string,
    input: SaveMemoryInput,
    importance: number,
    newEmbedding: number[],
    providerName: string
  ): Promise<SaveMemoryResult> {
    const existing = await this.repo.findById(existingId);
    if (!existing) {
      // Edge case — existing vanished, fall back to create
      return this.handleCreate(input, importance, newEmbedding, providerName);
    }

    // Ask the LLM to merge the two pieces into one coherent memory
    const mergedContent = await this.mergeWithLLM(existing.content, input.content);

    const newImportance = Math.max(importance, existing.importance);

    // Re-embed the merged content
    const embedder = getEmbeddingProvider();
    const mergedEmbedding = await embedder.embed(mergedContent);

    // Update the existing record with merged content
    await this.repo.updateContent(existingId, mergedContent, newImportance);
    await this.store.upsert({
      id: existingId,
      embedding: mergedEmbedding,
      metadata: {
        content: mergedContent,
        importance: newImportance,
        userId: input.userId,
        createdAt: new Date().toISOString(),
      },
    });

    logger.info("Memory merged (consolidation)", {
      memoryId: existingId,
      mergedFrom: 2,
    });

    return { memoryId: existingId, outcome: "merged", content: mergedContent };
  }

  // Ask the LLM to classify how a new memory relates to an existing one
private async classifyRelationship(
    existing: string,
    incoming: string
    ): Promise<"same" | "related" | "distinct"> {
    const llm = getCompletionProvider();

    const response = await llm.complete({
    messages: [
      {
        role: "user",
        content: `You are deciding how to store a new memory relative to an existing one. Respond with EXACTLY one word: "same", "related", or "distinct".

- "same": Both state the SAME core fact, just worded differently. (e.g. "lives in Delhi" vs "is based in Delhi"). The new one should replace the old.
- "related": They state DIFFERENT facts that are about the exact same narrow subject and should be combined into one. Use this RARELY and ONLY when combining them loses no information. (e.g. "likes tea" + "specifically green tea").
- "distinct": Different facts, even if loosely about the same person or topic. When in doubt, choose this.

Examples:
A: "User is a CSE student" | B: "User wants SDE jobs" → distinct (education vs career goal are different facts)
A: "User lives in Delhi" | B: "User is based in Delhi" → same
A: "User likes tea" | B: "User prefers green tea specifically" → related

Existing memory: "${existing}"
New information: "${incoming}"

Classification:`,
      },
    ],
    temperature: 0,
    maxTokens: 100,
  });

    const answer = response.content.trim().toLowerCase();
    console.log(`[CLASSIFIER] existing="${existing}" | incoming="${incoming}" | raw response="${response.content}" | parsed="${answer}"`);

    if (answer.includes("same")) return "same";
    if (answer.includes("related")) return "related";
    return "distinct";
}

  // LLM call to merge two memories into one
  private async mergeWithLLM(
    existing: string,
    incoming: string
  ): Promise<string> {
    const llm = getCompletionProvider();

    const response = await llm.complete({
    messages: [
      {
        role: "user",
        content: `Combine these two facts into ONE sentence that preserves EVERY piece of information from BOTH. Do not drop any detail. Do not summarize away specifics. If they conflict, keep the newer (second) fact. Respond with ONLY the combined statement.

Fact 1: "${existing}"
Fact 2: "${incoming}"

Combined (preserving all details):`,
      },
    ],
    temperature: 0.2,
    maxTokens: 200,
  });

    return response.content.trim().replace(/^["']|["']$/g, "");
  }

  // ---------- RECALL ----------
  async recall(query: RecallMemoryQuery): Promise<ScoredMemory[]> {
    const { userId, topK = 5, minScore } = query;

    logger.info("Recalling memories", {
      userId,
      queryPreview: query.query.substring(0, 80),
    });

    const embedder = getEmbeddingProvider();
    const queryEmbedding = await embedder.embed(query.query);

    // Fetch more candidates than we need, so re-ranking has room to work
    const searchResults = await this.store.search(queryEmbedding, userId, 10);

    if (searchResults.length === 0) {
      logger.info("No memories found", { userId });
      return [];
    }

    // Fetch full records from Postgres
    const ids = searchResults.map((r) => r.id);
    const records = (await this.repo.findByIds(ids)) as unknown as MemoryRecord[];

    // Score with the blended formula and re-rank
    const scored = this.scorer.score(searchResults, records);
    const top = this.scorer.selectTop(scored, topK, minScore);

    // Mark the returned memories as accessed (bumps recency + access count)
    await this.repo.markAccessed(top.map((m) => m.id));

    logger.info("Memories recalled", {
      userId,
      returned: top.length,
      topScore: top[0]?.scores.final,
    });

    return top;
  }

  // List all memories for a user (for inspection/debugging)
  async list(userId: string, limit: number = 50) {
    return this.repo.findByUserId(userId, limit);
  }
}
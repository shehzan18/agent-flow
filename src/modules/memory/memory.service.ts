import { v4 as uuidv4 } from "uuid";
import { getLLMProvider } from "../../infrastructure/llm/llm.factory";
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

    const llm = getLLMProvider();
    const providerName = llm.getProviderName();

    // Embed the new memory content
    const embedding = await llm.embed(input.content);

    // Search for similar existing memories
    const searchResults = await this.store.search(embedding, userId, 5);
    const topMatch = searchResults[0];

    // Only consult the LLM if there's a plausibly-related neighbor
    const CANDIDATE_FLOOR = 0.55;

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
    const llm = getLLMProvider();
    const embedding = await llm.embed(input.content);
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
    const llm = getLLMProvider();
    const mergedEmbedding = await llm.embed(mergedContent);

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
    const llm = getLLMProvider();

    const response = await llm.complete({
        messages: [
        {
            role: "user",
            content: `Compare these two facts and classify their relationship. Respond with EXACTLY one word: "same", "related", or "distinct".

    - "same": they express the same fact (one should replace the other, even if worded differently)
    - "related": different but connected facts about the same topic (should be combined)
    - "distinct": unrelated facts

    Fact A: "${existing}"
    Fact B: "${incoming}"

    Classification:`,
        },
        ],
        temperature: 0,
        maxTokens: 10,
    });

    const answer = response.content.trim().toLowerCase();

    if (answer.includes("same")) return "same";
    if (answer.includes("related")) return "related";
    return "distinct";
}

  // LLM call to merge two memories into one
  private async mergeWithLLM(
    existing: string,
    incoming: string
  ): Promise<string> {
    const llm = getLLMProvider();

    const response = await llm.complete({
      messages: [
        {
          role: "user",
          content: `Merge these two related facts into ONE concise memory statement. Keep all important information, remove redundancy, and prefer newer information if they conflict. Respond with ONLY the merged statement, no preamble.

Existing memory: "${existing}"
New information: "${incoming}"

Merged memory:`,
        },
      ],
      temperature: 0.3,
      maxTokens: 256,
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

    const llm = getLLMProvider();
    const queryEmbedding = await llm.embed(query.query);

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
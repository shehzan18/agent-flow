import { getLLMProvider } from "../../infrastructure/llm/llm.factory";
import { DocumentChunk, EmbeddedChunk } from "./rag.types";
import { logger } from "../../config/logger";
import { env } from "../../config/env";

export class Embedder {
  private batchSize = 10;
  private delayBetweenBatchesMs = 1000;

  async embedChunks(
    chunks: DocumentChunk[],
    providerOverride?: string
  ): Promise<EmbeddedChunk[]> {
    const provider = getLLMProvider(providerOverride);
    const providerName = provider.getProviderName();
    const model = this.getModelName(providerName);

    logger.info("Embedding chunks", {
      chunkCount: chunks.length,
      provider: providerName,
      model,
    });

    const embeddedChunks: EmbeddedChunk[] = [];

    // Process in batches to avoid rate limits
    for (let i = 0; i < chunks.length; i += this.batchSize) {
      const batch = chunks.slice(i, i + this.batchSize);

      logger.debug("Processing embedding batch", {
        batchNumber: Math.floor(i / this.batchSize) + 1,
        batchSize: batch.length,
        totalBatches: Math.ceil(chunks.length / this.batchSize),
      });

      // Embed each chunk in the batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (chunk) => {
          const embedding = await provider.embed(chunk.text);
          return {
            ...chunk,
            embedding,
            embeddingProvider: providerName,
            embeddingModel: model,
          };
        })
      );

      embeddedChunks.push(...batchResults);

      // Wait between batches if more remain (avoid rate limits)
      if (i + this.batchSize < chunks.length) {
        await this.sleep(this.delayBetweenBatchesMs);
      }
    }

    logger.info("Embedding complete", {
      chunkCount: embeddedChunks.length,
      dimensions: embeddedChunks[0]?.embedding.length,
    });

    return embeddedChunks;
  }

  async embedQuery(
    query: string,
    providerOverride?: string
  ): Promise<{ embedding: number[]; provider: string; model: string }> {
    const provider = getLLMProvider(providerOverride);
    const embedding = await provider.embed(query);

    return {
      embedding,
      provider: provider.getProviderName(),
      model: this.getModelName(provider.getProviderName()),
    };
  }

  private getModelName(provider: string): string {
    switch (provider) {
      case "gemini":
        return "gemini-embedding-001";
      case "openai":
        return "text-embedding-3-small";
      case "anthropic":
        throw new Error("Anthropic does not provide embeddings directly");
      default:
        return "unknown";
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
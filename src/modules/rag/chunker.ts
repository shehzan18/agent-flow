import { v4 as uuidv4 } from "uuid";
import { DocumentChunk } from "./rag.types";
import { logger } from "../../config/logger";

export interface ChunkerOptions {
  chunkSize?: number;        // target tokens per chunk
  chunkOverlap?: number;     // tokens that overlap between chunks
}

export class Chunker {
  private readonly DEFAULT_CHUNK_SIZE = 500;
  private readonly DEFAULT_OVERLAP = 50;

  // Rough token estimation: 1 token ≈ 4 characters in English
  private readonly CHARS_PER_TOKEN = 4;

  chunk(
    documentId: string,
    text: string,
    options?: ChunkerOptions
  ): DocumentChunk[] {
    const chunkSize = options?.chunkSize ?? this.DEFAULT_CHUNK_SIZE;
    const overlap = options?.chunkOverlap ?? this.DEFAULT_OVERLAP;

    // Convert token counts to character counts (rough estimate)
    const charSize = chunkSize * this.CHARS_PER_TOKEN;
    const charOverlap = overlap * this.CHARS_PER_TOKEN;

    logger.info("Chunking document", {
      documentId,
      textLength: text.length,
      chunkSize,
      overlap,
    });

    // Clean the text — normalize whitespace
    const cleaned = this.cleanText(text);

    // Split into sentences for cleaner chunk boundaries
    const sentences = this.splitIntoSentences(cleaned);

    const chunks: DocumentChunk[] = [];
    let currentChunk = "";
    let chunkIndex = 0;

    for (const sentence of sentences) {
      // If adding this sentence would exceed limit, save current chunk
      if (currentChunk.length + sentence.length > charSize && currentChunk.length > 0) {
        chunks.push({
          id: uuidv4(),
          documentId,
          text: currentChunk.trim(),
          index: chunkIndex++,
        });

        // Start new chunk with overlap from the end of previous chunk
        const overlapText = currentChunk.slice(-charOverlap);
        currentChunk = overlapText + " " + sentence;
      } else {
        currentChunk += " " + sentence;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: uuidv4(),
        documentId,
        text: currentChunk.trim(),
        index: chunkIndex,
      });
    }

    logger.info("Chunking complete", {
      documentId,
      chunkCount: chunks.length,
    });

    return chunks;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, "\n")           // normalize line endings
      .replace(/\n{3,}/g, "\n\n")       // collapse multiple newlines
      .replace(/[ \t]+/g, " ")          // collapse multiple spaces
      .replace(/\u0000/g, "")           // remove null bytes
      .trim();
  }

  private splitIntoSentences(text: string): string[] {
    // Split on sentence boundaries — periods, question marks, exclamation
    // followed by space and capital letter, OR newlines
    const sentences = text
      .split(/(?<=[.!?])\s+(?=[A-Z])|(?<=\n)\s*(?=\S)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return sentences;
  }
}
// A single chunk of text extracted from a document
export interface DocumentChunk {
  id: string;
  documentId: string;
  text: string;
  index: number; // position within the document (0, 1, 2...)
  metadata?: {
    pageNumber?: number;
    section?: string;
  };
}

// A chunk with its embedding vector ready to upload
export interface EmbeddedChunk extends DocumentChunk {
  embedding: number[];
  embeddingProvider: string; // "gemini", "openai", etc.
  embeddingModel: string;    // "text-embedding-004", etc.
}

// Result returned from vector search
export interface SearchResult {
  chunkId: string;
  documentId: string;
  text: string;
  score: number; // similarity 0-1
  metadata?: Record<string, any>;
}

// Search request
export interface SearchRequest {
  query: string;
  topK?: number;      // how many chunks to return (default 5)
  minScore?: number;  // filter out low-relevance results
  documentIds?: string[]; // optionally restrict to specific docs
}

// Document upload result
export interface UploadResult {
  documentId: string;
  filename: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
}

// Processing status for a document
export interface DocumentStatus {
  documentId: string;
  filename: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  chunkCount: number;
  error?: string;
}
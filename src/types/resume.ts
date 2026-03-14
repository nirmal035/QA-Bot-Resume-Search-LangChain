export interface ResumeData {
  email: string;
  phoneNumber: string;
  fullContent: string;
  fileName: string;
  processedAt: Date;
  embedding?: number[]; // Vector embedding for semantic search
}

export interface ExtractionResult {
  email: string | null;
  phoneNumber: string | null;
  fullContent: string;
}

export interface EmbeddingConfig {
  provider: string;
  model: string;
  apiKey: string;
}

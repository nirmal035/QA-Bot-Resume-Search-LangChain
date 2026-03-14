import { z } from "zod";

/**
 * Search request schema
 */
export const SearchRequestSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  searchType: z.enum(["keyword", "vector", "hybrid"], {
    errorMap: () => ({ message: "searchType must be 'keyword', 'vector', or 'hybrid'" })
  }),
  conversationId: z.string().optional(),
  topK: z.number().int().positive().optional().default(3)
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

/**
 * Search result item
 */
export interface SearchResultItem {
  name: string;
  email: string;
  phoneNumber: string;
  content: string;
  score: number;
  matchType?: "keyword" | "vector" | "hybrid";
}

/**
 * Search response
 */
export interface SearchResponse {
  query: string;
  searchType: string;
  topK: number;
  resultCount: number;
  duration: number;
  results: SearchResultItem[];
  metadata?: {
    hybridWeights?: {
      vector: number;
      keyword: number;
    };
    traceId?: string;
  };
}

/**
 * Error response
 */
export interface ErrorResponse {
  error: string;
  details?: string;
  timestamp: string;
}

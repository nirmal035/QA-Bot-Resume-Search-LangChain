import { ResumeVectorStore } from "../../lib/vectorstore/index.js";
import { SearchResultItem, SearchMetadata } from "./types.js";

/**
 * Pure vector search engine
 */
export class VectorSearchEngine {
  private vectorStore: ResumeVectorStore;

  constructor(vectorStore: ResumeVectorStore) {
    this.vectorStore = vectorStore;
  }

  /**
   * Perform pure vector similarity search
   */
  async search(query: string, topK: number, metadata: SearchMetadata): Promise<SearchResultItem[]> {
    console.log(`[${metadata.traceId}] [Vector Search] Query: "${query}", TopK: ${topK}`);
    const startTime = Date.now();

    try {
      // Perform similarity search with scores
      const results = await this.vectorStore.searchWithScores(query, topK);
      const duration = Date.now() - startTime;

      console.log(`[${metadata.traceId}] [Vector Search] Found ${results.length} results in ${duration}ms`);

      // Map to SearchResultItem format
      // Note: LangChain stores custom fields in metadata, but MongoDB docs have fields at top level
      // The metadata object may contain: name, email, phone (from MongoDB document)
      const items: SearchResultItem[] = results.map(([doc, score]) => {
        // Vector scores from cosine similarity are typically 0-1
        // Higher score = more similar
        const normalizedScore = this.normalizeVectorScore(score);
        const meta = doc.metadata || {};

        return {
          name: meta.name || "Unknown",
          email: meta.email || "Not found",
          phoneNumber: meta.phone?.toString() || meta.phoneNumber || "Not found",
          content: this.extractSnippet(doc.pageContent),
          score: normalizedScore,
          matchType: "vector",
        };
      });

      console.log(`[${metadata.traceId}] [Vector Search] Top score: ${items[0]?.score.toFixed(3) || 'N/A'}`);
      return items;
      
    } catch (error) {
      console.error(`[${metadata.traceId}] [Vector Search] Error:`, error);
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Normalize vector similarity score to 0-1 range
   * MongoDB Atlas vector search returns scores that may need normalization
   */
  private normalizeVectorScore(score: number): number {
    // Cosine similarity is typically between 0 and 1
    // Ensure it's clamped to this range
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Extract snippet from content
   */
  private extractSnippet(content: string, maxLength: number = 200): string {
    if (!content) return "";
    
    const snippet = content.substring(0, maxLength).trim();
    return snippet + (content.length > maxLength ? "..." : "");
  }
}

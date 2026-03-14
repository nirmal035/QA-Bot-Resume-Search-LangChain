import { KeywordSearchEngine } from "./keywordSearch.js";
import { VectorSearchEngine } from "./vectorSearch.js";
import { SearchResultItem, SearchMetadata } from "./types.js";

/**
 * Configuration for hybrid search
 */
export interface HybridSearchConfig {
  vectorWeight: number;
  keywordWeight: number;
}

/**
 * Hybrid search engine combining vector and keyword search
 */
export class HybridSearchEngine {
  private keywordEngine: KeywordSearchEngine;
  private vectorEngine: VectorSearchEngine;
  private config: HybridSearchConfig;

  constructor(
    keywordEngine: KeywordSearchEngine,
    vectorEngine: VectorSearchEngine,
    config: HybridSearchConfig
  ) {
    this.keywordEngine = keywordEngine;
    this.vectorEngine = vectorEngine;
    this.config = config;
    
    // Validate weights sum to 1.0
    const totalWeight = this.config.vectorWeight + this.config.keywordWeight;
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      console.warn(
        `[Hybrid Search] Weights don't sum to 1.0 (got ${totalWeight}). ` +
        `Using: vector=${this.config.vectorWeight}, keyword=${this.config.keywordWeight}`
      );
    }
  }

  /**
   * Perform hybrid search combining vector and keyword results
   */
  async search(query: string, topK: number, metadata: SearchMetadata): Promise<SearchResultItem[]> {
    console.log(`[${metadata.traceId}] [Hybrid Search] Query: "${query}", TopK: ${topK}`);
    console.log(
      `[${metadata.traceId}] [Hybrid Search] Weights: Vector=${this.config.vectorWeight}, ` +
      `Keyword=${this.config.keywordWeight}`
    );
    
    const startTime = Date.now();

    try {
      // Fetch more results from each engine for better merging
      const fetchSize = topK * 3;
      
      // Perform both searches in parallel
      const [vectorResults, keywordResults] = await Promise.all([
        this.vectorEngine.search(query, fetchSize, metadata),
        this.keywordEngine.search(query, fetchSize, metadata),
      ]);

      console.log(
        `[${metadata.traceId}] [Hybrid Search] Retrieved: ` +
        `${vectorResults.length} vector, ${keywordResults.length} keyword`
      );

      // Merge and score results
      const mergedResults = this.mergeResults(vectorResults, keywordResults);
      
      // Sort by hybrid score and return topK
      const topResults = mergedResults
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      const duration = Date.now() - startTime;
      console.log(
        `[${metadata.traceId}] [Hybrid Search] Completed in ${duration}ms, ` +
        `returning ${topResults.length} results`
      );
      
      if (topResults.length > 0) {
        console.log(
          `[${metadata.traceId}] [Hybrid Search] Top result: ` +
          `"${topResults[0].name}" (score: ${topResults[0].score.toFixed(3)})`
        );
      }

      return topResults;
      
    } catch (error) {
      console.error(`[${metadata.traceId}] [Hybrid Search] Error:`, error);
      throw new Error(`Hybrid search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Merge vector and keyword results with weighted scoring
   */
  private mergeResults(
    vectorResults: SearchResultItem[],
    keywordResults: SearchResultItem[]
  ): SearchResultItem[] {
    // Create a map to merge results by name (candidate name)
    const mergedMap = new Map<string, SearchResultItem>();

    // Add vector results with weighted scores
    vectorResults.forEach((result) => {
      const weightedScore = result.score * this.config.vectorWeight;
      
      mergedMap.set(result.name, {
        ...result,
        score: weightedScore,
        matchType: "hybrid",
      });
    });

    // Merge keyword results
    keywordResults.forEach((result) => {
      const weightedScore = result.score * this.config.keywordWeight;

      if (mergedMap.has(result.name)) {
        // Document found in both searches - combine scores
        const existing = mergedMap.get(result.name)!;
        existing.score = existing.score + weightedScore;
        
        // Use the longer content snippet (more context)
        if (result.content.length > existing.content.length) {
          existing.content = result.content;
        }
      } else {
        // Document only in keyword search
        mergedMap.set(result.name, {
          ...result,
          score: weightedScore,
          matchType: "hybrid",
        });
      }
    });

    return Array.from(mergedMap.values());
  }

  /**
   * Update hybrid search weights
   */
  updateWeights(vectorWeight: number, keywordWeight: number): void {
    this.config.vectorWeight = vectorWeight;
    this.config.keywordWeight = keywordWeight;
    
    console.log(`[Hybrid Search] Weights updated: vector=${vectorWeight}, keyword=${keywordWeight}`);
  }

  /**
   * Get current weights
   */
  getWeights(): HybridSearchConfig {
    return { ...this.config };
  }
}

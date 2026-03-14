import { Collection } from "mongodb";
import { SearchResultItem, SearchMetadata } from "./types.js";

/**
 * Keyword-based search on resume content and metadata
 */
export class KeywordSearchEngine {
  private collection: Collection;

  constructor(collection: Collection) {
    this.collection = collection;
  }

  /**
   * Perform keyword search using regex matching
   */
  async search(query: string, topK: number, metadata: SearchMetadata): Promise<SearchResultItem[]> {
    console.log(`[${metadata.traceId}] [Keyword Search] Query: "${query}", TopK: ${topK}`);
    const startTime = Date.now();

    try {
      // Split query into keywords and create regex pattern
      const keywords = query.trim().split(/\s+/);
      const searchRegex = new RegExp(keywords.join("|"), "i");

      // Find documents matching the keyword in content, name, skills, or email
      // Field names match MongoDB document structure: text, name, email, skills, role, etc.
      const cursor = this.collection
        .find({
          $or: [
            { text: { $regex: searchRegex } },
            { name: { $regex: searchRegex } },
            { email: { $regex: searchRegex } },
            { skills: { $regex: searchRegex } },
            { role: { $regex: searchRegex } },
            { company: { $regex: searchRegex } },
          ],
        })
        .limit(topK * 2); // Get more for better scoring

      const documents = await cursor.toArray();
      const duration = Date.now() - startTime;

      console.log(`[${metadata.traceId}] [Keyword Search] Found ${documents.length} candidates in ${duration}ms`);

      // Calculate relevance score based on keyword frequency and position
      // Field names match MongoDB document structure
      const results: SearchResultItem[] = documents.map((doc) => {
        const content = doc.text || "";
        const name = doc.name || "";
        const email = doc.email || "";
        const skills = Array.isArray(doc.skills) ? doc.skills.join(" ") : (doc.skills || "");
        const role = Array.isArray(doc.role) ? doc.role.join(" ") : (doc.role || "");
        
        // Count matches in each field
        const contentMatches = (content.match(searchRegex) || []).length;
        const nameMatches = (name.match(searchRegex) || []).length;
        const emailMatches = (email.match(searchRegex) || []).length;
        const skillsMatches = (skills.match(searchRegex) || []).length;
        const roleMatches = (role.match(searchRegex) || []).length;
        
        // Weight different fields (skills and role are highly relevant for job matching)
        const totalScore = 
          (contentMatches * 1.0) + 
          (nameMatches * 2.0) + 
          (emailMatches * 1.5) +
          (skillsMatches * 3.0) +
          (roleMatches * 2.5);
        
        // Normalize to 0-1 range (assuming max 30 matches is highly relevant)
        const normalizedScore = Math.min(totalScore / 30, 1.0);

        return {
          name: name || "Unknown",
          email: email || "Not found",
          phoneNumber: (doc.phoneNumber && doc.phoneNumber.toString()) || (doc.phone && doc.phone.toString()) || "Not found",
          content: this.extractSnippet(content, keywords),
          score: normalizedScore,
          matchType: "keyword",
        };
      });

      // Sort by score and return topK
      const topResults = results
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      console.log(`[${metadata.traceId}] [Keyword Search] Returning ${topResults.length} results`);
      return topResults;
      
    } catch (error) {
      console.error(`[${metadata.traceId}] [Keyword Search] Error:`, error);
      throw new Error(`Keyword search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract relevant snippet around matched keywords
   */
  private extractSnippet(content: string, keywords: string[], maxLength: number = 200): string {
    if (!content) return "";
    
    // Find first keyword match
    const lowerContent = content.toLowerCase();
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    
    let position = -1;
    for (const keyword of lowerKeywords) {
      position = lowerContent.indexOf(keyword);
      if (position !== -1) break;
    }
    
    if (position === -1) {
      // No match found, return beginning
      return content.substring(0, maxLength) + "...";
    }
    
    // Extract snippet around the match
    const start = Math.max(0, position - 50);
    const end = Math.min(content.length, position + maxLength - 50);
    
    let snippet = content.substring(start, end);
    if (start > 0) snippet = "..." + snippet;
    if (end < content.length) snippet = snippet + "...";
    
    return snippet.trim();
  }
}

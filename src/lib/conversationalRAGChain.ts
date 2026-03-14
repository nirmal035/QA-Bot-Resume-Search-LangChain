import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatMemoryManager } from "./memory/index.js";
import { RetrievalPipeline } from "../pipelines/index.js";
import { SearchResultItem } from "../types/index.js";

/**
 * System prompt for conversational RAG (Resume search with memory)
 */
const RAG_CONVERSATION_SYSTEM_PROMPT = `You are an expert AI assistant specializing in resume search and candidate analysis.

You help users find and filter candidates from a resume database. You maintain context across multiple questions:
- Remember user names and preferences mentioned earlier
- Build upon previous search queries and results
- Apply filters progressively (e.g., "filter those results" means use the previous search context)
- Provide specific, data-driven answers based on search results

When users ask follow-up questions like "filter those" or "from those results", refer to the previous search context.

IMPORTANT: When providing candidate recommendations:
- List specific candidate names and key qualifications
- Reference actual data from the search results
- Be concise but informative
- If no results match, clearly state that

Maintain a professional, helpful tone throughout the conversation.`;

/**
 * Prompt template for RAG with chat history
 */
const RAG_CONVERSATION_PROMPT_TEMPLATE = ChatPromptTemplate.fromMessages([
  ["system", RAG_CONVERSATION_SYSTEM_PROMPT],
  ["placeholder", "{chat_history}"],
  ["human", `Question: {input}

Search Results:
{search_results}

Based on the search results above and our conversation history, provide a helpful answer.`],
]);

/**
 * Format search results for the prompt
 */
function formatSearchResults(results: SearchResultItem[]): string {
  if (results.length === 0) {
    return "No matching candidates found.";
  }

  return results
    .map((result, idx) => {
      // Extract key info from content (first 200 chars)
      const contentPreview = result.content.substring(0, 200).replace(/\n/g, " ");
      
      return `${idx + 1}. ${result.name}
   Email: ${result.email}
   Phone: ${result.phoneNumber}
   Preview: ${contentPreview}...
   Match Score: ${result.score?.toFixed(3) || "N/A"}`;
    })
    .join("\n\n");
}

/**
 * Conversational RAG Chain Manager
 * Combines chat memory with resume search retrieval
 */
export class ConversationalRAGChainManager {
  private chain: RunnableSequence<any, string>;
  private memoryManager: ChatMemoryManager;
  private retrievalPipeline: RetrievalPipeline;
  private model: BaseChatModel;
  private lastSearchResults: SearchResultItem[] = [];
  private lastQuery: string = "";

  constructor(
    model: BaseChatModel,
    memoryManager: ChatMemoryManager,
    retrievalPipeline: RetrievalPipeline
  ) {
    this.model = model;
    this.memoryManager = memoryManager;
    this.retrievalPipeline = retrievalPipeline;

    // Build the RAG chain
    this.chain = RunnableSequence.from([
      RAG_CONVERSATION_PROMPT_TEMPLATE,
      model,
      new StringOutputParser(),
    ]);
  }

  /**
   * Process a conversational query with RAG
   */
  async chat(
    input: string,
    searchType: "keyword" | "vector" | "hybrid" = "hybrid",
    topK: number = 10,
    traceId?: string
  ): Promise<{ response: string; searchResults: SearchResultItem[] }> {
    const requestId = traceId || `chat_${Date.now()}`;
    
    console.log(`\n[ConversationalRAG:${requestId}] User: ${input}`);

    // Determine if this is a follow-up query (filter/refine previous results)
    const isFollowUp = this.isFollowUpQuery(input);
    
    let searchResults: SearchResultItem[];

    if (isFollowUp && this.lastSearchResults.length > 0) {
      // Use previous search results for follow-up questions
      console.log(`[ConversationalRAG:${requestId}] Detected follow-up query, using previous ${this.lastSearchResults.length} results`);
      searchResults = this.lastSearchResults;
    } else {
      // Perform new search
      console.log(`[ConversationalRAG:${requestId}] Performing ${searchType} search with topK=${topK}`);
      searchResults = await this.retrievalPipeline.search(
        input,
        searchType,
        topK,
        requestId
      );
      console.log(`[ConversationalRAG:${requestId}] Retrieved ${searchResults.length} results`);
      
      // Store for potential follow-up
      this.lastSearchResults = searchResults;
      this.lastQuery = input;
    }

    // Format search results for prompt
    const formattedResults = formatSearchResults(searchResults);

    // Load chat history
    const memory = this.memoryManager.getMemory();
    const memoryVariables = await memory.loadMemoryVariables({});

    // Invoke chain with history and search results
    const response = await this.chain.invoke({
      input,
      chat_history: memoryVariables.chat_history || [],
      search_results: formattedResults,
    });

    console.log(`[ConversationalRAG:${requestId}] AI: ${response.substring(0, 100)}...`);

    // Save exchange to memory
    await this.memoryManager.addExchange(input, response);

    return { response, searchResults };
  }

  /**
   * Detect if query is a follow-up (filter/refinement of previous results)
   */
  private isFollowUpQuery(input: string): boolean {
    const followUpPatterns = [
      /filter\s+(only\s+)?(those|these|them|the|that)/i,
      /from\s+(those|these|the|that)\s+results/i,
      /narrow\s+down/i,
      /refine\s+(those|these|the|that)/i,
      /only\s+(show|list|get)\s+(those|candidates|profiles)/i,
      /exclude\s+(those|these|candidates)/i,
    ];

    return followUpPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Get chat history
   */
  async getChatHistory(): Promise<any[]> {
    return await this.memoryManager.getMessages();
  }

  /**
   * Log chat history for debugging
   */
  async logHistory(): Promise<void> {
    await this.memoryManager.logHistory();
  }

  /**
   * Clear conversation memory
   */
  async clear(): Promise<void> {
    await this.memoryManager.clear();
    this.lastSearchResults = [];
    this.lastQuery = "";
  }

  /**
   * Get last search results
   */
  getLastSearchResults(): SearchResultItem[] {
    return this.lastSearchResults;
  }
}

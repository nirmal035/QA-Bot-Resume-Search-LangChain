import { BufferMemory } from "langchain/memory";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";
import { AIMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";

/**
 * Configuration for chat memory
 */
export interface ChatMemoryConfig {
  memoryKey?: string;
  inputKey?: string;
  outputKey?: string;
  returnMessages?: boolean;
  maxMessages?: number; // Limit number of messages to keep
}

/**
 * Chat Memory Manager
 * Wraps LangChain's BufferMemory with additional functionality:
 * - Logging of chat history
 * - Message count limiting
 * - Conversation context retrieval
 * - Search results caching for conversational filtering
 */
export class ChatMemoryManager {
  private memory: BufferMemory;
  private maxMessages: number;
  private conversationId: string;
  private lastSearchResults: any[] = []; // Cache last search results for filtering

  constructor(conversationId: string, config?: ChatMemoryConfig) {
    this.conversationId = conversationId;
    this.maxMessages = config?.maxMessages ?? 10; // Default: keep last 10 messages (5 exchanges)

    // Initialize BufferMemory with chat history
    this.memory = new BufferMemory({
      memoryKey: config?.memoryKey ?? "chat_history",
      inputKey: config?.inputKey ?? "input",
      outputKey: config?.outputKey ?? "output",
      returnMessages: config?.returnMessages ?? true,
      chatHistory: new ChatMessageHistory(),
    });

    console.log(
      `[ChatMemory:${conversationId}] Initialized with max ${this.maxMessages} messages`
    );
  }

  /**
   * Add a user message and AI response to memory
   */
  async addExchange(userInput: string, aiOutput: string): Promise<void> {
    await this.memory.saveContext(
      { input: userInput },
      { output: aiOutput }
    );

    // Trim messages if exceeding max
    await this.trimMessages();

    console.log(
      `[ChatMemory:${this.conversationId}] Added exchange. ` +
      `Total messages: ${await this.getMessageCount()}`
    );
  }

  /**
   * Get all messages from memory
   */
  async getMessages(): Promise<BaseMessage[]> {
    const memoryVariables = await this.memory.loadMemoryVariables({});
    const messages = memoryVariables.chat_history as BaseMessage[];
    return messages || [];
  }

  /**
   * Get chat history as formatted string for logging
   */
  async getChatHistoryString(): Promise<string> {
    const messages = await this.getMessages();
    
    if (messages.length === 0) {
      return "  (No messages yet)";
    }

    return messages
      .map((msg, idx) => {
        const type = msg instanceof HumanMessage ? "User" : "AI";
        const content = msg.content.toString().substring(0, 80); // Truncate for display
        return `  ${idx + 1}. [${type}]: ${content}${msg.content.toString().length > 80 ? "..." : ""}`;
      })
      .join("\n");
  }

  /**
   * Get the number of messages in memory
   */
  async getMessageCount(): Promise<number> {
    const messages = await this.getMessages();
    return messages.length;
  }

  /**
   * Clear all messages from memory
   */
  async clear(): Promise<void> {
    await this.memory.clear();
    console.log(`[ChatMemory:${this.conversationId}] Memory cleared`);
  }

  /**
   * Get the underlying BufferMemory instance (for chain integration)
   */
  getMemory(): BufferMemory {
    return this.memory;
  }

  /**
   * Trim messages to stay within maxMessages limit
   * Keeps most recent messages
   */
  private async trimMessages(): Promise<void> {
    const messages = await this.getMessages();
    
    if (messages.length > this.maxMessages) {
      const toRemove = messages.length - this.maxMessages;
      
      // Get the chat history and remove oldest messages
      const chatHistory = this.memory.chatHistory;
      
      // Clear and re-add only the recent messages
      await chatHistory.clear();
      const recentMessages = messages.slice(toRemove);
      
      for (const msg of recentMessages) {
        await chatHistory.addMessage(msg);
      }
      
      console.log(
        `[ChatMemory:${this.conversationId}] Trimmed ${toRemove} old messages. ` +
        `Keeping ${recentMessages.length} recent messages.`
      );
    }
  }

  /**
   * Log current chat history (for debugging)
   */
  async logHistory(): Promise<void> {
    console.log(`\n[ChatMemory:${this.conversationId}] === CHAT HISTORY ===`);
    const historyString = await this.getChatHistoryString();
    console.log(historyString);
    console.log(`[ChatMemory:${this.conversationId}] Total: ${await this.getMessageCount()} messages`);
    console.log(`[ChatMemory:${this.conversationId}] Cached search results: ${this.lastSearchResults.length}`);
    console.log(`===================================\n`);
  }

  /**
   * Store search results for conversational filtering
   */
  setLastSearchResults(results: any[]): void {
    this.lastSearchResults = results;
    console.log(
      `[ChatMemory:${this.conversationId}] Cached ${results.length} search results for filtering`
    );
  }

  /**
   * Get cached search results
   */
  getLastSearchResults(): any[] {
    return this.lastSearchResults;
  }

  /**
   * Check if there are cached search results
   */
  hasSearchResults(): boolean {
    return this.lastSearchResults.length > 0;
  }

  /**
   * Clear cached search results
   */
  clearSearchResults(): void {
    this.lastSearchResults = [];
    console.log(`[ChatMemory:${this.conversationId}] Cleared cached search results`);
  }
}

/**
 * Global conversation memory store
 * Maps conversation IDs to ChatMemoryManager instances
 */
class ConversationStore {
  private conversations = new Map<string, ChatMemoryManager>();

  /**
   * Get or create a memory manager for a conversation
   */
  getOrCreate(conversationId: string, config?: ChatMemoryConfig): ChatMemoryManager {
    if (!this.conversations.has(conversationId)) {
      const manager = new ChatMemoryManager(conversationId, config);
      this.conversations.set(conversationId, manager);
      console.log(`[ConversationStore] Created new conversation: ${conversationId}`);
    }
    return this.conversations.get(conversationId)!;
  }

  /**
   * Check if conversation exists
   */
  has(conversationId: string): boolean {
    return this.conversations.has(conversationId);
  }

  /**
   * Delete a conversation
   */
  delete(conversationId: string): boolean {
    const deleted = this.conversations.delete(conversationId);
    if (deleted) {
      console.log(`[ConversationStore] Deleted conversation: ${conversationId}`);
    }
    return deleted;
  }

  /**
   * Get all conversation IDs
   */
  getConversationIds(): string[] {
    return Array.from(this.conversations.keys());
  }

  /**
   * Clear all conversations
   */
  clear(): void {
    this.conversations.clear();
    console.log(`[ConversationStore] Cleared all conversations`);
  }

  /**
   * Get conversation count
   */
  size(): number {
    return this.conversations.size;
  }
}

// Export singleton instance
export const conversationStore = new ConversationStore();

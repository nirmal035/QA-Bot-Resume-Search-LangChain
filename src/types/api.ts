import { z } from "zod";

export const InvokeSchema = z.object({
  question: z.string().min(1),
  documentPath: z.string().optional(),
  documentText: z.string().optional(),
  promptType: z.enum(["default", "detailed", "concise", "technical"]).optional()
}).refine(v => !!(v.documentPath || v.documentText), {
  message: "Provide either documentPath or documentText"
});

export type InvokeBody = z.infer<typeof InvokeSchema>;

export type InvokeResult = {
  output: string;
  model: string;
  provider: string;
  promptType: string;
};

// Conversational query types
export const ConversationalQuerySchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(), // If not provided, a new conversation will be created
  includeHistory: z.boolean().optional().default(true),
  topK: z.number().min(1).max(100).optional().default(10), // Number of final results to return
  searchType: z.enum(["keyword", "vector", "hybrid"]).optional(),
});

export type ConversationalQueryBody = z.infer<typeof ConversationalQuerySchema>;

export type ConversationalQueryResult = {
  response: string; // Natural language response
  conversationId: string;
  messageCount: number; // Total messages in this conversation
  model: string;
  provider: string;
  searchResults?: Array<{
    fileName: string;
    email: string;
    phoneNumber: string;
    score: number;
    matchType?: string;
    extractedInfo?: {
      currentCompany?: string;
      location?: string;
      skills?: string[];
      experience?: string;
      keyHighlights?: string[];
    };
    llmReasoning?: string;
  }>; // Structured search results
  searchMetadata?: {
    query: string;
    searchType: string;
    resultCount: number;
    duration?: number;
  };
};

// Conversation management types
export const GetConversationHistorySchema = z.object({
  conversationId: z.string().min(1),
});

export type GetConversationHistoryBody = z.infer<typeof GetConversationHistorySchema>;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export type ConversationHistoryResult = {
  conversationId: string;
  messages: ChatMessage[];
  messageCount: number;
};

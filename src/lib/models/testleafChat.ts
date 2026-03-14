import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGeneration, ChatResult } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { ChatOpenAI } from "@langchain/openai";

export interface TestleafChatConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
}

/**
 * Custom LangChain chat model for Testleaf API
 * Based on OpenAI's chat completion format
 */
export class ChatTestleaf extends BaseChatModel {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  baseUrl: string;

  constructor(config: TestleafChatConfig) {
    super({});
    this.apiKey = config.apiKey;
    this.model = config.model || "gpt-4o-mini";
    this.temperature = config.temperature ?? 0.2;
    this.maxTokens = config.maxTokens || 4096;
    this.baseUrl = config.baseUrl || "https://api.testleaf.com/ai/v1/chat/completions";
  }

  _llmType(): string {
    return "testleaf";
  }

  /**
   * Convert LangChain messages to Testleaf API format
   */
  private convertMessages(messages: BaseMessage[]): Array<{ role: string; content: string }> {
    return messages.map((msg) => {
      let role = "user";
      
      if (msg instanceof AIMessage) {
        role = "assistant";
      } else if (msg instanceof SystemMessage) {
        role = "system";
      } else if (msg instanceof HumanMessage) {
        role = "user";
      }

      return {
        role,
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
      };
    });
  }

  /**
   * Main method to generate chat completions
   */
  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const convertedMessages = this.convertMessages(messages);
    
    // Log request for debugging
    console.log('Sending request to Testleaf API...');
    console.log('Messages:', convertedMessages);

    // Retry logic for rate limiting (HTTP 429) with exponential backoff
    const maxRetries = 4;
    const baseDelay = 500; // ms

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    let lastError: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(this.baseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            messages: convertedMessages,
            temperature: this.temperature,
            max_completion_tokens: this.maxTokens
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('Testleaf API Error:', response.status, errorData);

          // If rate limited, respect Retry-After header if present and retry
          if (response.status === 429 && attempt < maxRetries) {
            lastError = new Error(`Testleaf API rate limited: ${errorData}`);
            const retryAfter = response.headers.get("retry-after");
            const waitMs = retryAfter ? Number(retryAfter) * 1000 : baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
            console.warn(`Testleaf rate-limited, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
            await sleep(waitMs);
            continue;
          }

          // Non-retriable or out of retries
          throw new Error(`Testleaf API call failed: ${response.status} - ${errorData}`);
        }

        const data = await response.json();
        console.log('Testleaf API response:', data);

        // Extract response from Testleaf's nested structure
        const messageContent = data.transaction?.response?.choices?.[0]?.message?.content || "";
        const usage = data.transaction?.response?.usage;

        const generations: ChatGeneration[] = [
          {
            text: messageContent,
            message: new AIMessage(messageContent)
          }
        ];

        const llmOutput = {
          tokenUsage: {
            promptTokens: usage?.prompt_tokens || 0,
            completionTokens: usage?.completion_tokens || 0,
            totalTokens: usage?.total_tokens || 0
          }
        };

        return {
          generations,
          llmOutput
        };
      } catch (error) {
        lastError = error;
        // If this was the last attempt, break and rethrow below
        if (attempt === maxRetries) break;
        // small delay before next attempt
        const waitMs = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
        console.warn(`Testleaf request failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${waitMs}ms:`, error instanceof Error ? error.message : String(error));
        await sleep(waitMs);
      }
    }

    console.error('Error calling Testleaf API after retries:', lastError);
    // Attempt OpenAI fallback if available
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        console.log('Testleaf failed after retries — attempting fallback to OpenAI');
        const promptText = convertedMessages.map(m => `${m.role}: ${m.content}`).join('\n');
        const altModel = new ChatOpenAI({ apiKey: openaiKey, model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: this.temperature }) as unknown as BaseChatModel;
        // @ts-ignore
        const altResponse = await altModel.invoke(promptText);
        const responseText = typeof altResponse.content === 'string' ? altResponse.content : JSON.stringify(altResponse.content);

        const messageContent = responseText || "";
        const generations: ChatGeneration[] = [
          {
            text: messageContent,
            message: new AIMessage(messageContent)
          }
        ];

        const llmOutput = { tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };

        return { generations, llmOutput };
      } catch (altErr) {
        console.warn('OpenAI fallback failed:', altErr instanceof Error ? altErr.message : String(altErr));
      }
    }

    throw lastError;
  }

  /**
   * Simple invoke method for single prompts
   */
  async sendMessage(prompt: string): Promise<{ content: string; usage: any }> {
    const messages = [new HumanMessage(prompt)];
    const result = await this._generate(messages);
    
    return {
      content: result.generations[0].text,
      usage: {
        input_tokens: result.llmOutput?.tokenUsage?.promptTokens || 0,
        output_tokens: result.llmOutput?.tokenUsage?.completionTokens || 0
      }
    };
  }
}

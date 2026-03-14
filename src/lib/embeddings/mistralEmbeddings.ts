import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import { MistralAIEmbeddings } from "@langchain/mistralai";

/**
 * Mistral AI Embeddings wrapper with proper configuration
 * Model: mistral-embed
 * Dimension: 1024
 */
export class MistralEmbeddings extends Embeddings {
  private embeddings: MistralAIEmbeddings;

  constructor(params: EmbeddingsParams & { apiKey: string; modelName?: string }) {
    super(params);
    
    this.embeddings = new MistralAIEmbeddings({
      apiKey: params.apiKey,
      modelName: params.modelName || "mistral-embed",
    });
  }

  /**
   * Embed a single document
   */
  async embedQuery(text: string): Promise<number[]> {
    try {
      const embedding = await this.embeddings.embedQuery(text);
      
      // Validate dimension
      if (embedding.length !== 1024) {
        throw new Error(`Expected embedding dimension 1024, got ${embedding.length}`);
      }
      
      return embedding;
    } catch (error) {
      throw new Error(
        `Failed to embed query: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Embed multiple documents with batch processing
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      const embeddings = await this.embeddings.embedDocuments(texts);
      
      // Validate all dimensions
      for (const embedding of embeddings) {
        if (embedding.length !== 1024) {
          throw new Error(`Expected embedding dimension 1024, got ${embedding.length}`);
        }
      }
      
      return embeddings;
    } catch (error) {
      throw new Error(
        `Failed to embed documents: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Factory function to create embeddings based on provider
 */
export async function createEmbeddings(config: {
  provider: string;
  model: string;
  apiKey: string;
}): Promise<Embeddings> {
  const provider = config.provider.toLowerCase();

  switch (provider) {
    case "mistral": {
      if (!config.apiKey) {
        throw new Error("MISTRAL_API_KEY is required for Mistral embeddings");
      }
      
      return new MistralEmbeddings({
        apiKey: config.apiKey,
        modelName: config.model || "mistral-embed",
      });
    }

    case "openai": {
      // Fallback for OpenAI (keep for compatibility)
      const { OpenAIEmbeddings } = await import("@langchain/openai");
      
      if (!config.apiKey) {
        throw new Error("OPENAI_API_KEY is required for OpenAI embeddings");
      }
      
      return new OpenAIEmbeddings({
        openAIApiKey: config.apiKey,
        modelName: config.model || "text-embedding-3-small",
      });
    }

    default:
      throw new Error(
        `Unsupported embedding provider: "${provider}". Supported: mistral, openai`
      );
  }
}

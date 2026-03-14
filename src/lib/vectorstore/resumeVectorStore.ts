import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { createEmbeddings } from "../embeddings/index.js";

export interface VectorStoreConfig {
  mongoUri: string;
  dbName: string;
  collectionName: string;
  indexName?: string;
  embeddingProvider: string;
  embeddingModel: string;
  apiKey: string;
}

/**
 * LangChain MongoDB Vector Store for Resume Management
 * Supports Mistral (mistral-embed, 1024 dims) and OpenAI embeddings
 * Uses LangChain's MongoDBAtlasVectorSearch integration
 */
export class ResumeVectorStore {
  private client: MongoClient;
  private vectorStore: MongoDBAtlasVectorSearch | null = null;
  private embeddings: Embeddings | null = null;
  private config: VectorStoreConfig;

  constructor(config: VectorStoreConfig) {
    this.config = config;
    this.client = new MongoClient(config.mongoUri);
  }

  /**
   * Initialize the vector store connection
   */
  async initialize(): Promise<void> {
    try {
      // Initialize embeddings using factory
      this.embeddings = await createEmbeddings({
        provider: this.config.embeddingProvider,
        model: this.config.embeddingModel,
        apiKey: this.config.apiKey,
      });
      
      console.log(`Initialized ${this.config.embeddingProvider} embeddings (${this.config.embeddingModel})`);
      
      await this.client.connect();
      
      const collection = this.client
        .db(this.config.dbName)
        .collection(this.config.collectionName);

      // Initialize LangChain MongoDB Atlas Vector Search
      // Field mapping matches MongoDB document structure:
      // - textKey: "text" (resume full content)
      // - embeddingKey: "embedding" (vector embeddings)
      this.vectorStore = new MongoDBAtlasVectorSearch(this.embeddings, {
        collection,
        indexName: this.config.indexName || "vector_index",
        textKey: "text",
        embeddingKey: "embedding"
      });

      console.log(`Connected to MongoDB Vector Store: ${this.config.dbName}.${this.config.collectionName}`);
    } catch (error) {
      throw new Error(`Failed to initialize vector store: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Add resume documents with automatic embedding generation
   * Uses batch processing for efficiency
   */
  async addResumes(resumes: Array<{
    email: string;
    phoneNumber: string;
    fullContent: string;
    fileName: string;
  }>): Promise<void> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized. Call initialize() first.");
    }

    if (resumes.length === 0) {
      console.log("No resumes to add");
      return;
    }

    try {
      console.log(`Generating embeddings for ${resumes.length} resumes...`);
      const startTime = Date.now();

      // Compute embeddings explicitly so we can control document schema
      const texts = resumes.map(r => r.fullContent);
      if (!this.embeddings) throw new Error("Embeddings provider not initialized");
      const vectors = await this.embeddings.embedDocuments(texts);

      // Prepare documents for insertion with expected field names: text, embedding, email, phoneNumber
      const collection = this.client.db(this.config.dbName).collection(this.config.collectionName);
      const docsToInsert = resumes.map((r, i) => ({
        text: r.fullContent,
        embedding: vectors[i],
        email: r.email,
        phoneNumber: r.phoneNumber,
        fileName: r.fileName,
        processedAt: new Date().toISOString()
      }));

      const result = await collection.insertMany(docsToInsert);
      const duration = Date.now() - startTime;
      console.log(`✓ Added ${Object.keys(result.insertedIds).length} resumes with embeddings (${duration}ms)`);
    } catch (error) {
      throw new Error(`Failed to add resumes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Add resumes with concurrent batch processing for better performance
   * Recommended for large datasets
   */
  async addResumesBatch(
    resumes: Array<{
      email: string;
      phoneNumber: string;
      fullContent: string;
      fileName: string;
    }>,
    batchSize: number = 1
  ): Promise<void> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized. Call initialize() first.");
    }

    if (resumes.length === 0) {
      console.log("No resumes to add");
      return;
    }

    console.log(`Processing ${resumes.length} resumes in batches of ${batchSize}...`);
    const startTime = Date.now();

    // Split into batches
    const batches: typeof resumes[] = [];
    for (let i = 0; i < resumes.length; i += batchSize) {
      batches.push(resumes.slice(i, i + batchSize));
    }

    let successCount = 0;
    let failureCount = 0;

    // Process batches sequentially to avoid overwhelming the API
    for (let idx = 0; idx < batches.length; idx++) {
      const batch = batches[idx];

      try {
        // Compute embeddings for this batch and insert with desired schema
        const texts = batch.map(r => r.fullContent);
        if (!this.embeddings) throw new Error("Embeddings provider not initialized");
        const vectors = await this.embeddings.embedDocuments(texts);

        const collection = this.client.db(this.config.dbName).collection(this.config.collectionName);
        const docs = batch.map((r, i) => ({
          text: r.fullContent,
          embedding: vectors[i],
          email: r.email,
          phoneNumber: r.phoneNumber,
          fileName: r.fileName,
          processedAt: new Date().toISOString()
        }));

        const res = await collection.insertMany(docs);
        console.log(`✓ Batch ${idx + 1}/${batches.length} completed (${batch.length} resumes)`);
        successCount += Object.keys(res.insertedIds).length;
      } catch (error) {
        console.error(`✗ Batch ${idx + 1} failed:`, error instanceof Error ? error.message : String(error));
        failureCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✓ Batch processing complete:`);
    console.log(`  - Successful: ${successCount} resumes`);
    console.log(`  - Failed: ${failureCount} batches`);
    console.log(`  - Duration: ${duration}ms`);

    if (failureCount > 0) {
      throw new Error(`${failureCount} batch(es) failed during processing`);
    }
  }

  /**
   * Semantic search across resumes using vector similarity
   */
  async searchResumes(query: string, topK: number = 5): Promise<Document[]> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized. Call initialize() first.");
    }

    try {
      const results = await this.vectorStore.similaritySearch(query, topK);
      return results;
    } catch (error) {
      throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Semantic search with relevance scores
   */
  async searchWithScores(query: string, topK: number = 5): Promise<Array<[Document, number]>> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized. Call initialize() first.");
    }

    try {
      const results = await this.vectorStore.similaritySearchWithScore(query, topK);
      return results;
    } catch (error) {
      throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clear all documents from the collection
   */
  async clearCollection(): Promise<void> {
    try {
      const collection = this.client
        .db(this.config.dbName)
        .collection(this.config.collectionName);
      
      const result = await collection.deleteMany({});
      console.log(`Cleared ${result.deletedCount} documents from collection`);
    } catch (error) {
      throw new Error(`Failed to clear collection: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Close the MongoDB connection
   */
  async close(): Promise<void> {
    await this.client.close();
    console.log("MongoDB connection closed");
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{ count: number; dbSize: string }> {
    try {
      const collection = this.client
        .db(this.config.dbName)
        .collection(this.config.collectionName);
      
      const count = await collection.countDocuments();
      const stats = await this.client.db(this.config.dbName).stats();
      
      return {
        count,
        dbSize: `${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`
      };
    } catch (error) {
      throw new Error(`Failed to get stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the underlying vector store for advanced operations
   */
  getVectorStore(): MongoDBAtlasVectorSearch {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized. Call initialize() first.");
    }
    return this.vectorStore;
  }
}

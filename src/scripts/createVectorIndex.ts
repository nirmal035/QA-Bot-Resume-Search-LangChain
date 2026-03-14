import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

/**
 * MongoDB Atlas Vector Search Index Creation Script
 * 
 * This script creates a vector search index for the resumes collection
 * Required for semantic similarity search using embeddings
 * 
 * Prerequisites:
 * - MongoDB Atlas cluster (M10 or higher recommended)
 * - Atlas Search enabled
 * 
 * Index Configuration:
 * - Type: vectorSearch
 * - Dimension: 1024 (for Mistral mistral-embed model)
 * - Similarity: cosine
 * - Field: embedding
 */

interface IndexDefinition {
  name: string;
  type: "vectorSearch";
  definition: {
    fields: Array<{
      type: "vector";
      path: string;
      numDimensions: number;
      similarity: "cosine" | "euclidean" | "dotProduct";
    }>;
  };
}

async function createVectorIndex(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "db_resumes";
  const collectionName = process.env.MONGODB_COLLECTION || "resumes";
  const indexName = process.env.MONGODB_VECTOR_INDEX || "resume_vector_index";
  const dimension = Number(process.env.EMBEDDING_DIMENSION) || 1024;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is not set in .env file");
  }

  console.log("🔧 MongoDB Vector Index Setup\n");
  console.log("Configuration:");
  console.log(`  - Database: ${dbName}`);
  console.log(`  - Collection: ${collectionName}`);
  console.log(`  - Index Name: ${indexName}`);
  console.log(`  - Dimension: ${dimension}`);
  console.log(`  - Similarity: cosine`);
  console.log();

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log("✓ Connected to MongoDB\n");

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Check if collection exists
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length === 0) {
      console.log(`⚠️  Collection "${collectionName}" does not exist. Creating it...`);
      await db.createCollection(collectionName);
      console.log(`✓ Collection created\n`);
    }

    // MongoDB Atlas Vector Search Index definition
    const indexDefinition: IndexDefinition = {
      name: indexName,
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            path: "embedding",
            numDimensions: dimension,
            similarity: "cosine"
          }
        ]
      }
    };

    console.log("📋 Index Definition:");
    console.log(JSON.stringify(indexDefinition, null, 2));
    console.log();

    // Note: Creating vector search indexes requires MongoDB Atlas
    // and must be done through the Atlas UI or Atlas API
    console.log("⚠️  IMPORTANT:");
    console.log("Vector search indexes must be created through MongoDB Atlas UI or API.");
    console.log();
    console.log("To create the index:");
    console.log("1. Go to MongoDB Atlas Console");
    console.log("2. Navigate to your cluster → Collections");
    console.log(`3. Select database: ${dbName}`);
    console.log(`4. Select collection: ${collectionName}`);
    console.log("5. Go to 'Search Indexes' tab");
    console.log("6. Click 'Create Search Index'");
    console.log("7. Choose 'JSON Editor'");
    console.log("8. Paste the following JSON:");
    console.log();
    console.log("=" .repeat(60));
    console.log(JSON.stringify(indexDefinition, null, 2));
    console.log("=" .repeat(60));
    console.log();

    // Check existing indexes
    console.log("📊 Checking existing indexes...\n");
    const indexes = await collection.indexes();
    
    console.log(`Found ${indexes.length} index(es):`);
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}`);
      console.log(`   Keys: ${JSON.stringify(index.key)}`);
    });
    console.log();

    console.log("✅ Setup information provided successfully");
    console.log();
    console.log("💡 Alternative: Use mongosh to create the index:");
    console.log();
    console.log(`db.${collectionName}.createSearchIndex(`);
    console.log(`  "${indexName}",`);
    console.log(`  "vectorSearch",`);
    console.log(`  {`);
    console.log(`    fields: [`);
    console.log(`      {`);
    console.log(`        type: "vector",`);
    console.log(`        path: "embedding",`);
    console.log(`        numDimensions: ${dimension},`);
    console.log(`        similarity: "cosine"`);
    console.log(`      }`);
    console.log(`    ]`);
    console.log(`  }`);
    console.log(`)`);
    console.log();

  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    await client.close();
    console.log("✓ Connection closed");
  }
}

/**
 * Verify vector index exists and is ready
 */
async function verifyVectorIndex(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "db_resumes";
  const collectionName = process.env.MONGODB_COLLECTION || "resumes";
  const indexName = process.env.MONGODB_VECTOR_INDEX || "resume_vector_index";

  if (!mongoUri) {
    throw new Error("MONGODB_URI is not set in .env file");
  }

  console.log("\n🔍 Verifying Vector Index\n");

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const collection = client.db(dbName).collection(collectionName);

    // List all indexes
    const indexes = await collection.indexes();
    const vectorIndex = indexes.find((idx) => idx.name === indexName);

    if (vectorIndex) {
      console.log(`✅ Vector index "${indexName}" found!`);
      console.log("Index details:");
      console.log(JSON.stringify(vectorIndex, null, 2));
    } else {
      console.log(`❌ Vector index "${indexName}" not found`);
      console.log(`\nAvailable indexes:`);
      indexes.forEach((idx) => console.log(`  - ${idx.name}`));
    }

  } catch (error) {
    console.error("❌ Verification failed:", error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    await client.close();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === "verify") {
      await verifyVectorIndex();
    } else {
      await createVectorIndex();
    }
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1]?.includes("createVectorIndex")) {
  main();
}

export { createVectorIndex, verifyVectorIndex };

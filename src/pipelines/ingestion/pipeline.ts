import dns from "dns";
import path from "node:path";
import { config } from "../../config/index.js";
import { ResumeVectorStore } from "../../lib/vectorstore/index.js";
import { loadDocument, getResumeFiles, extractResumeInfo, validateResumeMetadata } from "../../utils/index.js";

// Fix DNS resolution for MongoDB Atlas SRV records
dns.setServers(['8.8.8.8', '8.8.4.4']);

/**
 * Main ingestion pipeline with vector embeddings using Mistral
 */
export async function ingestResumes(clearExisting: boolean = false): Promise<void> {
  console.log("🚀 Starting resume ingestion pipeline with vector embeddings\n");
  
  // Validate configuration
  if (!config.mongodb.uri) {
    throw new Error("MONGODB_URI is not set in .env file");
  }
  
  const embeddingProvider = config.embeddings.provider;
  const apiKey = embeddingProvider === "mistral" 
    ? config.mistral.apiKey 
    : config.openai.apiKey;
  
  if (!apiKey) {
    throw new Error(`${embeddingProvider.toUpperCase()}_API_KEY is required for generating embeddings`);
  }
  
  console.log(`📊 Configuration:`);
  console.log(`  - Database: ${config.mongodb.dbName}.${config.mongodb.collection}`);
  console.log(`  - Embedding Provider: ${embeddingProvider}`);
  console.log(`  - Embedding Model: ${config.embeddings.model}`);
  console.log(`  - Dimension: ${config.embeddings.dimension}`);
  console.log();
  
  // Initialize LangChain MongoDB Vector Store
  const vectorStore = new ResumeVectorStore({
    mongoUri: config.mongodb.uri,
    dbName: config.mongodb.dbName,
    collectionName: config.mongodb.collection,
    indexName: config.mongodb.vectorIndexName,
    embeddingProvider: embeddingProvider,
    embeddingModel: config.embeddings.model,
    apiKey: apiKey
  });
  
  try {
    // Connect to MongoDB
    await vectorStore.initialize();
    
    // Clear existing data if requested
    if (clearExisting) {
      console.log("🗑️  Clearing existing resumes...");
      await vectorStore.clearCollection();
      console.log();
    }
    
    // Get all resume files
    console.log(`📂 Reading documents from: ${config.documents.folder}`);
    const resumeFiles = await getResumeFiles(config.documents.folder);
    
    if (resumeFiles.length === 0) {
      console.log("⚠️  No PDF or DOCX files found in documents folder");
      return;
    }
    
    console.log(`✓ Found ${resumeFiles.length} resume(s)\n`);
    
    // Process each resume with concurrent loading
    console.log("📝 Processing resumes...\n");
    const resumesData: Array<{
      email: string;
      phoneNumber: string;
      fullContent: string;
      fileName: string;
    }> = [];
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const warnings: Array<{ fileName: string; warnings: string[] }> = [];
    const skipped: Array<{ fileName: string; reason: string }> = [];
    
    // Process resumes concurrently for better performance
    const results = await Promise.allSettled(
      resumeFiles.map(async (filePath) => {
        const fileName = path.basename(filePath);
        
        console.log(`  Processing: ${fileName}...`);
        
        // Load document content
        const content = await loadDocument(filePath);
        
        // Extract information using regex
        const extractedInfo = extractResumeInfo(content);
        
        // Check if at least email or phone number is found
        const hasEmail = !!extractedInfo.email;
        const hasPhone = !!extractedInfo.phoneNumber;
        
        if (!hasEmail && !hasPhone) {
          console.log(`    ⚠️  SKIPPED: No email or phone number found`);
          console.log();
          return { 
            skipped: true, 
            fileName,
            reason: "No contact information found (email or phone number required)"
          };
        }
        
        // Validate metadata
        const validation = validateResumeMetadata(extractedInfo);
        
        // Create resume data object
        const resumeData = {
          email: extractedInfo.email || "Not found",
          phoneNumber: extractedInfo.phoneNumber || "Not found",
          fullContent: extractedInfo.fullContent,
          fileName: fileName
        };
        
        console.log(`    ✓ Email: ${resumeData.email}`);
        console.log(`    ✓ Phone: ${resumeData.phoneNumber}`);
        console.log(`    ✓ Content: ${resumeData.fullContent.length} chars`);
        
        if (validation.warnings.length > 0) {
          console.log(`    ⚠️  Warnings: ${validation.warnings.join(", ")}`);
        }
        console.log();
        
        return { resumeData, validation, fileName, skipped: false };
      })
    );
    
    // Process results
    for (const result of results) {
      if (result.status === "fulfilled") {
        // Check if resume was skipped
        if (result.value.skipped) {
          skipped.push({
            fileName: result.value.fileName,
            reason: result.value.reason!
          });
          skippedCount++;
        } else {
          // Add to resumes data
          resumesData.push(result.value.resumeData!);
          if (result.value.validation && result.value.validation.warnings.length > 0) {
            warnings.push({
              fileName: result.value.fileName,
              warnings: result.value.validation.warnings
            });
          }
          successCount++;
        }
      } else {
        console.error(`✗ Error:`, result.reason instanceof Error ? result.reason.message : String(result.reason));
        console.log();
        errorCount++;
      }
    }
    
    // Add all resumes with embeddings to MongoDB using batch processing
    if (resumesData.length > 0) {
      console.log(`🔄 Generating embeddings and storing ${resumesData.length} resume(s)...`);
      
      // Use batch size from config
      const batchSize = config.ingestion.batchSize;
      console.log(`   Batch size: ${batchSize}`);
      await vectorStore.addResumesBatch(resumesData, batchSize);
      console.log();
    } else {
      console.log("⚠️  No resumes to ingest (all files skipped or failed)\n");
    }
    
    // Summary
    console.log("=" .repeat(60));
    console.log("✅ INGESTION COMPLETE");
    console.log("=" .repeat(60));
    console.log(`📊 Statistics:`);
    console.log(`  - Total files: ${resumeFiles.length}`);
    console.log(`  - Successful: ${successCount}`);
    console.log(`  - Skipped: ${skippedCount}`);
    console.log(`  - Errors: ${errorCount}`);
    console.log(`  - Embeddings generated: ${resumesData.length}`);
    console.log(`  - Warnings: ${warnings.length}`);
    
    if (skipped.length > 0) {
      console.log(`\n⏭️  Skipped files (no contact info):`);
      skipped.forEach(({ fileName, reason }) => {
        console.log(`  - ${fileName}: ${reason}`);
      });
    }
    
    if (warnings.length > 0) {
      console.log(`\n⚠️  Files with warnings:`);
      warnings.forEach(({ fileName, warnings: fileWarnings }) => {
        console.log(`  - ${fileName}:`);
        fileWarnings.forEach(w => console.log(`    • ${w}`));
      });
    }
    console.log();

  } catch (error) {
    console.error("❌ Ingestion failed:", error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    // Close MongoDB connection
    await vectorStore.close();
  }
}

/**
 * Run the ingestion pipeline if this script is executed directly
 * Usage: tsx src/pipelines/ingestion/pipeline.ts [--clear]
 */
async function main() {
  const clearExisting = process.argv.includes("--clear");
  
  try {
    await ingestResumes(clearExisting);
    console.log("Done!");
    process.exit(0);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1]?.includes("pipeline")) {
  main();
}

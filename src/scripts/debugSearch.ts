import { MongoClient } from "mongodb";
import { config } from "../config/index.js";

async function main() {
  const mongoUri = config.mongodb.uri;
  const dbName = config.mongodb.dbName;
  const collectionName = config.mongodb.collection;

  if (!mongoUri) {
    console.error("MONGODB_URI is not configured. Set it in your .env file.");
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log(`Connected to MongoDB: ${dbName}.${collectionName}`);

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const count = await collection.countDocuments();
    console.log(`Document count: ${count}`);

    console.log("\nIndexes:");
    const indexes = await collection.indexes();
    indexes.forEach((idx, i) => {
      console.log(`${i + 1}. ${idx.name} -> ${JSON.stringify(idx.key)}`);
    });

    console.log("\nSample document (first 1):");
    const sample = await collection.findOne({}, { projection: { _id: 0 } });
    if (!sample) {
      console.log("No documents found in collection.");
    } else {
      console.log(JSON.stringify(sample, null, 2));

      // Print top-level keys
      console.log("\nTop-level keys:", Object.keys(sample));

      // If there is an embeddings field, print its type/length
      if (sample.embedding) {
        if (Array.isArray(sample.embedding)) {
          console.log(`Embedding is array, length=${sample.embedding.length}`);
        } else {
          console.log(`Embedding field type: ${typeof sample.embedding}`);
        }
      }

      // If metadata exists, print metadata keys
      if (sample.metadata) {
        console.log("Metadata keys:", Object.keys(sample.metadata));
      }
    }

  } catch (err) {
    console.error("Error while inspecting collection:", err instanceof Error ? err.message : String(err));
    process.exit(2);
  } finally {
    await client.close();
  }
}

if (import.meta.url === `file://${process.cwd().replace(/\\/g, "/")}/src/scripts/debugSearch.ts`) {
  main();
}

export { main };

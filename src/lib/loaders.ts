import path from "node:path";
import fs from "node:fs/promises";
import { Document } from "@langchain/core/documents";

const loaderCache = new Map<string, any>();

async function getLoader(type: string) {
  if (!loaderCache.has(type)) {
    switch (type) {
      case "pdf":
        const { PDFLoader } = await import("@langchain/community/document_loaders/fs/pdf");
        loaderCache.set(type, PDFLoader);
        break;
      case "docx":
        const { DocxLoader } = await import("@langchain/community/document_loaders/fs/docx");
        loaderCache.set(type, DocxLoader);
        break;
    }
  }
  return loaderCache.get(type);
}

export async function loadDocumentToString(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === ".pdf") {
      const PDFLoader = await getLoader("pdf");
      const loader = new PDFLoader(filePath, {
        parsedItemSeparator: "\n\n",
        splitPages: true
      });
      const pdfDocs = await loader.load();
      
      return pdfDocs
        .map((d: Document, i: number) => `[Page ${i + 1}]\n${d.pageContent.trim()}`)
        .join("\n\n---\n\n");
    }

    if (ext === ".docx") {
      const DocxLoader = await getLoader("docx");
      const docs = await new DocxLoader(filePath).load();
      
      return docs
        .map((d: Document) => d.pageContent.trim())
        .filter((content: string) => content.length > 0)
        .join("\n\n");
    }

    // Plain text fallback (optimized for large files)
    const stats = await fs.stat(filePath);
    const raw = await fs.readFile(filePath, "utf8");
    
    // For very large files, provide a warning in metadata
    if (stats.size > 1_000_000) { // > 1MB
      console.warn(`Large file loaded: ${filePath} (${(stats.size / 1_000_000).toFixed(2)}MB)`);
    }
    
    return raw.trim();
    
  } catch (error) {
    throw new Error(
      `Failed to load ${ext} file at ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

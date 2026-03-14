import path from "node:path";
import fs from "node:fs/promises";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { Document } from "@langchain/core/documents";

/**
 * Load a PDF or DOCX document and return its text content
 */
export async function loadDocument(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === ".pdf") {
      const loader = new PDFLoader(filePath, {
        parsedItemSeparator: " ",
        splitPages: false
      });
      const docs = await loader.load();
      
      return docs
        .map((d: Document) => d.pageContent.trim())
        .join("\n\n");
    }

    if (ext === ".docx") {
      const loader = new DocxLoader(filePath);
      const docs = await loader.load();
      
      return docs
        .map((d: Document) => d.pageContent.trim())
        .filter((content: string) => content.length > 0)
        .join("\n\n");
    }

    throw new Error(`Unsupported file type: ${ext}. Only .pdf and .docx are supported.`);
    
  } catch (error) {
    throw new Error(
      `Failed to load document at ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get all PDF and DOCX files from a directory
 */
export async function getResumeFiles(documentsDir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(documentsDir);
    const resumeFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === ".pdf" || ext === ".docx";
    });
    
    return resumeFiles.map(file => path.join(documentsDir, file));
  } catch (error) {
    throw new Error(
      `Failed to read documents directory at ${documentsDir}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

import fs from "fs/promises";
const pdfParse = require("pdf-parse");
import { logger } from "../../config/logger";

export interface ExtractedDocument {
  text: string;
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    creator?: string;
    creationDate?: Date;
  };
}

export class PdfExtractor {
  async extractFromFile(filePath: string): Promise<ExtractedDocument> {
    logger.info("Extracting text from PDF", { filePath });

    try {
      // Read the PDF as a buffer
      const buffer = await fs.readFile(filePath);

      // Parse the PDF
      const data = await pdfParse(buffer);

      logger.info("PDF extracted successfully", {
        pageCount: data.numpages,
        textLength: data.text.length,
      });

      return {
        text: data.text,
        pageCount: data.numpages,
        metadata: {
          title: data.info?.Title,
          author: data.info?.Author,
          creator: data.info?.Creator,
          creationDate: data.info?.CreationDate
            ? new Date(data.info.CreationDate)
            : undefined,
        },
      };
    } catch (error: any) {
      logger.error("PDF extraction failed", {
        filePath,
        error: error.message,
      });
      throw new Error(`Failed to extract PDF: ${error.message}`);
    }
  }

  async extractFromBuffer(buffer: Buffer): Promise<ExtractedDocument> {
    const data = await pdfParse(buffer);
    return {
      text: data.text,
      pageCount: data.numpages,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        creator: data.info?.Creator,
      },
    };
  }
}
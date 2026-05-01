/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PDFDocument } from "pdf-lib";
import { logger } from "./logger";
import { AppError } from "./appError";
import { httpStatus } from "../constants";

// Merge multiple PDF buffers into a single PDF
export const mergePDFs = async (pdfBuffers: Buffer[]): Promise<Buffer> => {
  try {
    if (pdfBuffers.length === 0) {
      throw new Error("No PDF buffers provided for merging");
    }

    if (pdfBuffers.length === 1) {
      logger.info("Only one PDF provided, returning as-is");
      return pdfBuffers[0];
    }

    logger.info(`Merging ${pdfBuffers.length} PDF documents...`);

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    // Process each PDF buffer
    for (let i = 0; i < pdfBuffers.length; i++) {
      const pdfBuffer = pdfBuffers[i];
      const pdf = await PDFDocument.load(pdfBuffer);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

      // Add all pages from this PDF
      pages.forEach((page) => {
        mergedPdf.addPage(page);
      });

      logger.info(`Merged PDF ${i + 1}/${pdfBuffers.length}`);
    }

    const mergedPdfBytes = await mergedPdf.save();
    const finalBuffer = Buffer.from(mergedPdfBytes);

    logger.info(`PDF merge complete. Final size: ${finalBuffer.length} bytes`);

    return finalBuffer;
  } catch (error: any) {
    logger.error("PDF merge failed:", error);
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "PDF_MERGE_ERROR", `Failed to merge PDFs: ${error.message}`);
  }
};

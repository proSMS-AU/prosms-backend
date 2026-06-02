/* eslint-disable no-plusplus */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-await-in-loop */
import { InvoiceModel } from "../model/invoice.model";
import { TemplateModel, TemplateType } from "../model/template.model";
import { AppError } from "../utils/appError";
import { DATA_NOT_FOUND, httpStatus, invoiceTypes } from "../constants";
import { CloudflareService } from "./cloudflare.service";
import { logger } from "../utils";
import { mergePDFs } from "../utils/pdfMerger";
import { chunkInvoiceItems, itemsToPlaceholders, calculateInvoiceTotals } from "../utils/invoiceHelpers";
// Reuse from certificate service
import axios from "axios";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { StudentModel } from "../model/student.model";
import { ClassModel } from "../model/class.model";
import { generateSequentialId } from "../utils/sequentialIdGenerator";
import { QueryBuilder } from "../utils/queryBuilder";
import { PDFDocument } from "pdf-lib";
import { AutoInvoiceStudentSnapshotT, GenerateManualInvoiceRequestT } from "../schemas/invoice.schema";

const execAsync = promisify(exec);
const tempDir = path.join(__dirname, "../temp");

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Download template from R2
const downloadTemplateFromR2 = async (templateUrl: string): Promise<Buffer> => {
  try {
    const response = await axios.get(templateUrl, { responseType: "arraybuffer" });
    return Buffer.from(response.data);
  } catch (error) {
    logger.error("Failed to download template from R2:", error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "TEMPLATE_DOWNLOAD_ERROR",
      "Failed to download template from storage"
    );
  }
};

// Fill template
const fillTemplate = async (templateBuffer: Buffer, data: any): Promise<Buffer> => {
  try {
    const zip = new PizZip(templateBuffer);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
      delimiters: { start: "«", end: "»" }
    });

    doc.render(data);

    return doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE"
    });
  } catch (error: any) {
    logger.error("Template fill error:", error);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "TEMPLATE_FILL_ERROR",
      error.message || "Template render failed"
    );
  }
};

// Convert to PDF
const convertToPdf = async (docxBuffer: Buffer): Promise<Buffer> => {
  const tempDocxPath = path.join(tempDir, `temp_invoice_${Date.now()}_${Math.random()}.docx`);
  const tempPdfPath = tempDocxPath.replace(".docx", ".pdf");

  try {
    fs.writeFileSync(tempDocxPath, docxBuffer);

    const command = `soffice --headless --convert-to pdf --outdir "${tempDir}" "${tempDocxPath}"`;

    logger.info("Converting invoice DOCX to PDF...");
    await execAsync(command);
    // await new Promise((resolve) => setTimeout(resolve, 2000));
    while (!fs.existsSync(tempPdfPath)) {
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!fs.existsSync(tempPdfPath)) {
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "PDF_Conversion_Error", "PDF file was not created");
    }

    const pdfBuffer = fs.readFileSync(tempPdfPath);
    logger.info("Invoice PDF created successfully, size:", pdfBuffer.length, "bytes");

    // Cleanup
    if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath);
    if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);

    // return pdfBuffer;
    const normalizePdf = async (buffer: Buffer) => {
      const doc = await PDFDocument.load(buffer);
      return Buffer.from(await doc.save());
    };
    return normalizePdf(pdfBuffer);
  } catch (error: any) {
    try {
      if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath);
      if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
    } catch {
      /* empty */
    }

    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "PDF_CONVERSION_ERROR",
      `Failed to convert to PDF: ${error.message}`
    );
  }
};

// Generate manual invoice with multi-page support
const generateManualInvoice = async (data: GenerateManualInvoiceRequestT, organizationId: string) => {
  try {
    // 1. Fetch template
    const template = await TemplateModel.findById(data.templateId);
    if (!template) {
      throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Invoice template not found");
    }

    if (template.templateType !== TemplateType.INVOICE) {
      throw new AppError(httpStatus.BAD_REQUEST, "INVALID_TEMPLATE", "Template is not an invoice template");
    }

    // 2. Generate unique invoice ID
    const invoiceId = await generateSequentialId({
      key: `invoice:${organizationId}`,
      prefix: "INV",
      middleIndicator: "M",
      pad: 7
    });

    // 3. Calculate totals
    const totals = calculateInvoiceTotals(data.items);

    // 4. Prepare base data (common for all pages)
    const baseData = {
      inv_date: data.invoiceDate,
      due_date: data.dueDate,
      inv_no: invoiceId,
      p_order: data.purchaseOrder,
      name: data.name,
      address: data.address,
      town: data.town,
      postcode: data.postcode,
      state: data.state,
      ...totals
    };

    // 5. Download template
    const templateBuffer = await downloadTemplateFromR2(template.templateUrl);

    // 6. Handle multi-page if items > 20
    const itemChunks = chunkInvoiceItems(data.items);
    const pagesNeeded = itemChunks.length;

    logger.info(`Generating invoice with ${data.items.length} items across ${pagesNeeded} page(s)`);

    const pdfBuffers: Buffer[] = [];

    // 7. Generate pages
    for (let pageIndex = 0; pageIndex < pagesNeeded; pageIndex++) {
      const chunk = itemChunks[pageIndex];
      // const itemPlaceholders = itemsToPlaceholders(chunk, pageIndex * 20);
      const itemPlaceholders = itemsToPlaceholders(chunk);

      const pageData = {
        ...baseData,
        ...itemPlaceholders
      };

      logger.info(`Filling invoice template for page ${pageIndex + 1}/${pagesNeeded}...`);

      const filledDocx = await fillTemplate(templateBuffer, pageData);
      const pdfBuffer = await convertToPdf(filledDocx);

      pdfBuffers.push(pdfBuffer);
    }

    // 8. Merge PDFs if multiple pages
    let finalPdf: Buffer;
    if (pdfBuffers.length > 1) {
      logger.info(`Merging ${pdfBuffers.length} invoice pages...`);
      finalPdf = await mergePDFs(pdfBuffers);
    } else {
      finalPdf = pdfBuffers[0];
    }

    // 9. Upload to R2
    const uploadResult = await CloudflareService.uploadBufferToR2(
      finalPdf,
      `invoice_${invoiceId}.pdf`,
      "invoices",
      true
    );

    if (!uploadResult.success) {
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Failed to upload invoice");
    }

    // 10. Save invoice record
    const invoice = await InvoiceModel.create({
      createdBy: data.createdBy,
      organizationId,
      invoiceType: "MANUAL",
      invoiceId,
      templateId: data.templateId,
      invoiceKey: uploadResult.key!
    });

    logger.info(`Invoice ${invoiceId} generated successfully`);

    return {
      invoice,
      invoiceId,
      // invoiceUrl: uploadResult.publicUrl,
      invoiceKey: uploadResult.key,
      totalPages: pagesNeeded,
      totalItems: data.items.length
    };
  } catch (error: any) {
    logger.error("Manual invoice generation failed:", error);
    throw error;
  }
};

const generateAutoInvoice = async (
  templateId: string,
  studentId: string,
  studentSnapshot: AutoInvoiceStudentSnapshotT,
  classIds: string[],
  createdBy: string,
  organizationId: string
) => {
  // 1️ Fetch student
  const student = await StudentModel.findById(studentId);
  if (!student) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Student not found");
  }

  // 2️ Fetch classes
  const classes = await ClassModel.find({
    _id: { $in: classIds },
    organizationId
  });

  if (classes.length !== classIds.length) {
    throw new AppError(httpStatus.BAD_REQUEST, "INVALID_CLASSES", "One or more classes not found");
  }

  // 3️ Enrollment validation + invoice items
  const items = classes.map((cls) => {
    const enrollment = cls.enrollments.find((e) => e.studentInfo.id === studentId);

    if (!enrollment) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "NOT_ENROLLED",
        `Student not enrolled in class: ${cls.classDetails.classTitle}`
      );
    }

    const price = cls.classDetails.classFee || 0;

    const gstAmount = cls.classDetails.gst === "gst-applied" ? cls.classDetails.gstAmount || 0 : 0;

    return {
      description: cls.classDetails.classTitle,
      price,
      qty: 1,
      gst: gstAmount,
      amount: price + gstAmount
    };
  });

  // 4️ Invoice meta
  const invoiceId = await generateSequentialId({
    key: `invoice:${organizationId}`,
    prefix: "INV",
    pad: 7,
    middleIndicator: "A"
  });
  const invoiceDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(invoiceDate.getDate() + 7);

  const name = `${student.personalInfo.givenName} ${student.personalInfo.surname}`;
  const addr = student.address.primaryPostalAddress;

  const baseData = {
    inv_date: invoiceDate.toISOString().split("T")[0],
    due_date: dueDate.toISOString().split("T")[0],
    inv_no: invoiceId,
    p_order: "Auto Order",
    name,
    address: addr.street,
    town: addr.city,
    state: addr.state,
    postcode: addr.postCode,
    ...calculateInvoiceTotals(items)
  };

  // 5️ Fetch template
  const template = await TemplateModel.findById(templateId);

  if (!template) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Invoice template not found");
  }

  if (template.templateType !== TemplateType.INVOICE && template.createdBy !== "ADMIN") {
    throw new AppError(httpStatus.BAD_REQUEST, "INVALID_TEMPLATE", "Invalid invoice template");
  }

  const templateBuffer = await downloadTemplateFromR2(template.templateUrl);

  // 6 Multi-page handling
  const chunks = chunkInvoiceItems(items);
  const pdfBuffers: Buffer[] = [];

  for (const chunk of chunks) {
    const pageData = {
      ...baseData,
      ...itemsToPlaceholders(chunk)
    };

    const filledDocx = await fillTemplate(templateBuffer, pageData);
    const pdf = await convertToPdf(filledDocx);
    pdfBuffers.push(pdf);
  }

  // 7 Merge PDFs
  const finalPdf = pdfBuffers.length > 1 ? await mergePDFs(pdfBuffers) : pdfBuffers[0];

  // 8 Upload to R2
  const upload = await CloudflareService.uploadBufferToR2(finalPdf, `invoice_${invoiceId}.pdf`, "invoices", true);

  if (!upload.success) {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Invoice upload failed");
  }

  // 9 Save invoice
  const invoice = await InvoiceModel.create({
    createdBy,
    organizationId,
    studentId,
    studentSnapshot,
    classIds,
    invoiceType: invoiceTypes[0],
    invoiceId,
    templateId: template._id,
    invoiceKey: upload.key
  });

  return {
    invoiceId,
    invoice,
    invoiceKey: upload.key,
    totalItems: items.length,
    totalPages: chunks.length
  };
};

const getAutoInvoices = async (query: Record<string, string>, organizationId: string) => {
  const queryBuilder = new QueryBuilder(InvoiceModel.find({ invoiceType: invoiceTypes[0], organizationId }), query);
  const searchableFields = ["invoiceId"];
  const invoices = await queryBuilder.search(searchableFields).filter().sort().select().pagination().build();
  const meta = await queryBuilder.getMeta();
  return {
    invoices,
    ...meta
  };
};

const getManualInvoices = async (query: Record<string, string>, organizationId: string) => {
  const queryBuilder = new QueryBuilder(
    InvoiceModel.find({ invoiceType: invoiceTypes[1], createdBy: "ADMIN", organizationId }),
    query
  );
  const searchableFields = ["invoiceId"];
  const invoices = await queryBuilder.search(searchableFields).filter().sort().select().pagination().build();

  const meta = await queryBuilder.getMeta();
  return {
    invoices,
    ...meta
  };
};

const getSAInvoices = async (query: Record<string, string>) => {
  const queryBuilder = new QueryBuilder(InvoiceModel.find({ createdBy: "SUPER_ADMIN" }), query);
  const searchableFields = ["invoiceId"];
  const invoices = await queryBuilder.search(searchableFields).filter().sort().select().pagination().build();
  const meta = await queryBuilder.getMeta();
  return {
    invoices,
    ...meta
  };
};

const getInvoiceById = async (id: string) => {
  const invoice = await InvoiceModel.findOne({ invoiceId: id });
  if (!invoice) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Invoice not found");
  }
  return invoice;
};

const deleteInvoiceById = async (invoiceId: string) => {
  const invoice = await InvoiceModel.findByIdAndDelete(invoiceId);
  if (!invoice) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Invoice not found");
  }
  await CloudflareService.deleteFileFromR2(invoice.invoiceKey);
  return invoice;
};

// Bulk create invoices for multiple students in the same class
const bulkCreateInvoices = async (
  classId: string,
  studentIds: string[],
  templateId: string,
  organizationId: string,
  createdBy: string
) => {
  const results: { studentId: string; success: boolean; invoiceId?: string; reason?: string }[] = [];

  for (const studentId of studentIds) {
    try {
      const student = await StudentModel.findById(studentId);
      if (!student) {
        results.push({ studentId, success: false, reason: "Student not found" });
        continue;
      }

      const addr = (student.address as any)?.primaryPostalAddress;
      const snapshot: AutoInvoiceStudentSnapshotT = {
        id: studentId,
        name: `${student.personalInfo.givenName} ${student.personalInfo.surname ?? ""}`.trim(),
        email: student.contactDetails?.email ?? "",
        phone: (student.contactDetails as any)?.personalPhone ?? "",
        address: {
          street: addr?.street ?? "N/A",
          city: addr?.city ?? "N/A",
          state: addr?.state ?? "N/A",
          postcode: addr?.postCode ?? "N/A",
          country: addr?.country ?? "Australia"
        }
      };

      const invoice = await generateAutoInvoice(templateId, studentId, snapshot, [classId], createdBy, organizationId);
      results.push({ studentId, success: true, invoiceId: String((invoice as any)._id) });
    } catch (err: unknown) {
      const msg = err instanceof AppError ? err.message : "Unknown error";
      results.push({ studentId, success: false, reason: msg });
    }
  }

  return results;
};

export const InvoiceServices = {
  generateManualInvoice,
  generateAutoInvoice,
  bulkCreateInvoices,
  getAutoInvoices,
  getManualInvoices,
  getInvoiceById,
  deleteInvoiceById,
  getSAInvoices
};

/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import { exec } from "child_process";
import { promisify } from "util";
import axios from "axios";
import config from "config";
import { PDFDocument } from "pdf-lib";

import { CertificateModel } from "../model/certificate.model";
import { TemplateModel, TemplateType } from "../model/template.model";
import { ClassModel } from "../model/class.model";
import { AppError } from "../utils/appError";
import { certificateVerifyEndPoint, DATA_NOT_FOUND, httpStatus, separatorWords } from "../constants";
import { GenerateCertificateT } from "../schemas/certificate.schema";
import { CloudflareService } from "./cloudflare.service";
import { logger } from "../utils";
import { generateQRCodeFile } from "../utils/qrCode";
import Docxtemplater from "docxtemplater";
import { sendEmail } from "../utils/sendEmail";
import { Types } from "mongoose";
import { StudentModel } from "../model/student.model";
import { mergePDFs } from "../utils/pdfMerger";
import { chunkUnitsToPlaceholders, calculatePagesNeeded } from "../utils/unitChunker";
import { generateSequentialId } from "../utils/sequentialIdGenerator";
import { EnrollmentsT } from "../schemas/class.schema";
import { QualificationModel } from "../model/qualification.model";

const tempDir = path.join(__dirname, "../temp");
const execAsync = promisify(exec);

// Ensure temp directory exists
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

function parseQualificationTitle(title: string) {
  const regex = new RegExp(`\\b(${separatorWords.join("|")})\\b`, "i");
  const match = title.match(regex);
  if (!match) return null;

  const separator = match[0];
  const separatorIndex = match.index!;

  const level = title.substring(0, separatorIndex).trim();
  const name = title.substring(separatorIndex + separator.length).trim();

  return {
    QUAL_LEVEL: level,
    SEPARATOR: separator,
    COURSE_NAME: name
  };
}

// Prepare base certificate data (without units - they'll be added per page)
const prepareBaseCertificateData = async (
  studentName: string,
  classData: any,
  certificateShortId: string,
  givenCertIssueDate?: string
) => {
  const qualification = await QualificationModel.findById(classData.qualificationId);
  if (!qualification) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Qualification not found to generate certificate");
  }

  const parsedTitle = parseQualificationTitle(qualification?.title as string) || {
    QUAL_LEVEL: "",
    SEPARATOR: "",
    COURSE_NAME: ""
  };

  const issuedDate = new Date().toLocaleDateString("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const streamValue = qualification?.stream ? `\n${qualification.stream}` : "";

  return {
    CLI_NAME: studentName,
    COURSE_ID: qualification?.code,
    QUAL_LEVEL: parsedTitle.QUAL_LEVEL,
    SEPARATOR_WORD: parsedTitle.SEPARATOR,
    SEPARATOR_NAME: parsedTitle.SEPARATOR,
    COURSE_NAME: parsedTitle.COURSE_NAME,
    STREAM: streamValue,
    CERT_NO: certificateShortId,
    _dtCompleted: givenCertIssueDate ?? issuedDate,
    MAX_DATE: givenCertIssueDate ?? issuedDate,
    QR_CODE: ""
  };
};

const fillTemplate = async (templateBuffer: Buffer, data: any): Promise<Buffer> => {
  try {
    const zip = new PizZip(templateBuffer);

    let ImageModule: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const m = require("docxtemplater-image-module-free");
      ImageModule = m.default || m;
    } catch (e) {
      logger.error("FAILED TO LOAD IMAGE MODULE", e);
      throw e;
    }

    const imageModule = new ImageModule({
      centered: false,
      getImage: (tagValue: any, tagName: string) => {
        logger.info(`Image module called for tag: ${tagName}`);

        if (typeof tagValue === "string") {
          if (tagValue.startsWith("data:image")) {
            const base64 = tagValue.split(",")[1];
            logger.info("Converting data URL to buffer");
            return Buffer.from(base64, "base64");
          } else if (fs.existsSync(tagValue)) {
            logger.info("Reading image from file path:", tagValue);
            const buffer = fs.readFileSync(tagValue);
            logger.info("File buffer size:", buffer.length, "bytes");
            return buffer;
          }
        }

        logger.error(`Invalid image value for tag: ${tagName}`);
        throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "Image_module_error", "Invalid image value");
      },
      getSize: (img: Buffer, tagValue: any, tagName: string) => {
        logger.info(`getSize called for ${tagName}, buffer size: ${img.length} bytes`);
        return [200, 200]; // qr code size
      }
    });

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
      delimiters: { start: "«", end: "»" },
      modules: [imageModule]
    });

    doc.render(data);

    const buffer = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE"
    });

    return buffer;
  } catch (error: any) {
    if (error.properties && error.properties.errors) {
      logger.error("Template filling errors:", error.properties.errors);
    } else {
      logger.error("Template fill error:", error);
    }
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "TEMPLATE_FILL_ERROR",
      error.message || "Template render failed"
    );
  }
};

const convertToPdf = async (docxBuffer: Buffer, qrCodePath: string): Promise<Buffer> => {
  const tempDocxPath = path.join(tempDir, `temp_${Date.now()}_${Math.random()}.docx`);
  const tempPdfPath = tempDocxPath.replace(".docx", ".pdf");

  try {
    fs.writeFileSync(tempDocxPath, docxBuffer);

    const command = `soffice --headless --convert-to pdf --outdir "${tempDir}" "${tempDocxPath}"`;

    logger.info("Converting DOCX to PDF...");
    await execAsync(command);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (!fs.existsSync(tempPdfPath)) {
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "PDF_Conversion_Error", "PDF file was not created");
    }

    let pdfBuffer = fs.readFileSync(tempPdfPath);
    logger.info("PDF created successfully, size:", pdfBuffer.length, "bytes");

    // Overlay the QR code
    try {
      logger.info("Adding QR code to PDF...");
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      const qrImageBytes = fs.readFileSync(qrCodePath);
      const qrImage = await pdfDoc.embedPng(qrImageBytes);

      const qrWidth = 80;
      const qrHeight = 80;
      const pageWidth = firstPage.getWidth();
      const x = pageWidth - qrWidth - 50;
      const y = 170;

      firstPage.drawImage(qrImage, {
        x: x,
        y: y,
        width: qrWidth,
        height: qrHeight
      });

      logger.info("QR code added to PDF successfully");
      pdfBuffer = Buffer.from(await pdfDoc.save());
    } catch (pdfLibError: any) {
      logger.warn("Could not add QR code with pdf-lib:", pdfLibError.message);
      logger.info("Using original PDF from LibreOffice conversion");
    }

    // Cleanup
    if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath);
    if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);

    return pdfBuffer;
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

// Generate certificate for ATTAINMENT or CERTIFICATE_SINGLE with multi-page support
const generateSingleDocumentCertificate = async (
  template: any,
  baseData: any,
  units: any[],
  qrCodePath: string,
  templateType: TemplateType
): Promise<Buffer> => {
  try {
    const pdfBuffers: Buffer[] = [];

    // Determine units per page based on template type
    const unitsPerPage = templateType === TemplateType.ATTAINMENT ? 10 : 30;
    const pagesNeeded = calculatePagesNeeded(units.length, unitsPerPage);

    logger.info(`Generating ${templateType} with ${units.length} units across ${pagesNeeded} page(s)`);

    // Download template once
    const templateBuffer = await downloadTemplateFromR2(template.templateUrl);

    // Generate pages
    for (let pageIndex = 0; pageIndex < pagesNeeded; pageIndex++) {
      const startIndex = pageIndex * unitsPerPage;
      const unitPlaceholders = chunkUnitsToPlaceholders(units, startIndex, unitsPerPage);

      // Combine base data with unit placeholders
      const pageData = {
        ...baseData,
        ...unitPlaceholders
      };

      logger.info(`Filling template for page ${pageIndex + 1}/${pagesNeeded}...`);

      // Fill template with data
      const filledDocxBuffer = await fillTemplate(templateBuffer, pageData);

      // Convert to PDF
      const pdfBuffer = await convertToPdf(filledDocxBuffer, qrCodePath);

      pdfBuffers.push(pdfBuffer);
    }

    // Merge all PDFs if multiple pages
    if (pdfBuffers.length > 1) {
      logger.info(`Merging ${pdfBuffers.length} PDF pages...`);
      return await mergePDFs(pdfBuffers);
    }

    return pdfBuffers[0];
  } catch (error: any) {
    logger.error("Single document certificate generation failed:", error);
    throw error;
  }
};

// Generate CERTIFICATE_DOUBLE with two-page template + unit overflow support
const generateDoubleCertificate = async (
  template: any,
  baseData: any,
  units: any[],
  qrCodePath: string
): Promise<Buffer> => {
  try {
    const pdfBuffers: Buffer[] = [];

    // Page 1: Student & Course Info (no units)
    logger.info("Generating Page 1 (Student & Course Info)...");
    const page1Buffer = await downloadTemplateFromR2(template.templateUrl);
    const page1Data = { ...baseData }; // No units on page 1
    const filledPage1 = await fillTemplate(page1Buffer, page1Data);
    const page1Pdf = await convertToPdf(filledPage1, qrCodePath);
    pdfBuffers.push(page1Pdf);

    // Page 2+: Record of Results (with overflow support)
    if (!template.templatePage2Url) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "TEMPLATE_ERROR",
        "Page 2 template missing for CERTIFICATE_DOUBLE"
      );
    }

    const unitsPerPage = 30;
    const page2sNeeded = calculatePagesNeeded(units.length, unitsPerPage);

    logger.info(`Generating ${page2sNeeded} Record of Results page(s) for ${units.length} units...`);

    const page2Buffer = await downloadTemplateFromR2(template.templatePage2Url);

    for (let pageIndex = 0; pageIndex < page2sNeeded; pageIndex++) {
      const startIndex = pageIndex * unitsPerPage;
      const unitPlaceholders = chunkUnitsToPlaceholders(units, startIndex, unitsPerPage);

      // Page 2 needs base info + units
      const page2Data = {
        ...baseData,
        ...unitPlaceholders
      };

      logger.info(`Filling Page 2 template (${pageIndex + 1}/${page2sNeeded})...`);

      const filledPage2 = await fillTemplate(page2Buffer, page2Data);
      const page2Pdf = await convertToPdf(filledPage2, qrCodePath);
      pdfBuffers.push(page2Pdf);
    }

    // Merge all pages
    logger.info(`Merging ${pdfBuffers.length} pages (1 info + ${page2sNeeded} results)...`);
    return await mergePDFs(pdfBuffers);
  } catch (error: any) {
    logger.error("CERTIFICATE_DOUBLE generation failed:", error);
    throw error;
  }
};

// Generate certificates for multiple students
const generateCertificates = async (data: GenerateCertificateT, organizationId: string) => {
  // 1. Fetch template
  const template = await TemplateModel.findById(data.templateId);
  if (!template) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Template not found to create certificate");
  }

  // 2. Fetch class
  const classData = await ClassModel.findById(data.classId);
  if (!classData) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Class not found to create certificate");
  }

  if (!classData.enrollments || classData.enrollments.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      DATA_NOT_FOUND.code,
      "No enrollments found for this class to create certificate"
    );
  }

  // 3. Build enrollment lookup
  const enrollmentMap = new Map<string, EnrollmentsT>(
    classData.enrollments.map((enr) => [enr.studentInfo.id.toString(), enr as unknown as EnrollmentsT])
  );

  // 4. Build issued certificate set
  const issuedSet = new Set(
    classData.enrollments
      .filter((enr) => enr.certificateIssuedDate !== null)
      .map((enr) => enr.studentInfo.id.toString())
  );

  const results: any[] = [];

  // 5. Process each student
  for (const student of data.students) {
    const studentId = student.id.toString();
    let qrCodeFilePath: string | null = null;
    let studentName: string = "Unknown"; // safe fallback before enrollment lookup

    const enrollment = enrollmentMap.get(studentId);

    // Not enrolled
    if (!enrollment) {
      results.push({
        studentId,
        success: false,
        error: "Student not enrolled in this class"
      });
      continue;
    }

    studentName = enrollment.studentInfo.name; // assign only when enrollment exists

    // Already has certificate
    if (issuedSet.has(studentId)) {
      results.push({
        studentId,
        studentName,
        success: false,
        error: `Certificate already generated for ${studentName}`
      });
      continue;
    }

    // Not completed
    if (!enrollment.completionDate) {
      results.push({
        studentId,
        studentName,
        success: false,
        error: `Course not completed for ${studentName}`
      });
      continue;
    }

    try {
      // Fetch student (for full details)
      const stuData = await StudentModel.findById(studentId);

      if (!stuData) {
        results.push({
          studentId,
          studentName,
          success: false,
          error: "Student not found"
        });
        continue;
      }

      const fullName = stuData.personalInfo.givenName + " " + stuData.personalInfo.surname;

      // Generate certificate ID — atomic $inc, retry handles upsert race
      const certificateShortId = await generateSequentialId({
        key: `certificate:${organizationId}`,
        prefix: "CERT",
        pad: 8
      });

      // Generate QR
      qrCodeFilePath = await generateQRCodeFile(certificateShortId);

      const baseData = await prepareBaseCertificateData(
        fullName,
        classData,
        certificateShortId,
        data.students.find((s) => s.id === studentId)?.generatingDate
      );

      const units = enrollment.unitsOfCompetency || [];

      let pdfBuffer: Buffer;

      if (template.isMultiPageTemplate) {
        pdfBuffer = await generateDoubleCertificate(template, baseData, units, qrCodeFilePath);
      } else {
        pdfBuffer = await generateSingleDocumentCertificate(
          template,
          baseData,
          units,
          qrCodeFilePath,
          template.templateType
        );
      }

      // Cleanup QR after PDF generation
      if (qrCodeFilePath && fs.existsSync(qrCodeFilePath)) {
        fs.unlinkSync(qrCodeFilePath);
        qrCodeFilePath = null;
      }

      // Upload PDF
      const uploadResult = await CloudflareService.uploadBufferToR2(
        pdfBuffer,
        `certificate_${certificateShortId}.pdf`,
        "certificates",
        true
      );

      if (!uploadResult.success) {
        throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Failed to upload certificate");
      }

      // Issued date (per student)
      const issuedDate = student.generatingDate ? new Date(student.generatingDate) : new Date();

      const clientUrl = config.get("server.clientUrl");

      // Save certificate with compound key collision guard
      try {
        const certificate = await CertificateModel.create({
          organizationId,
          classId: data.classId,
          studentId: stuData._id,
          certificateShortId,
          templateId: data.templateId,
          certificateKey: uploadResult.key!,
          qrCodeUrl: `${clientUrl}/${certificateVerifyEndPoint}/${certificateShortId}`,
          issuedDate
        });

        // Update enrollment
        await ClassModel.updateOne(
          {
            _id: data.classId,
            "enrollments.studentInfo.id": stuData._id
          },
          {
            $set: {
              "enrollments.$.certificateId": certificate._id,
              "enrollments.$.certificateIssuedDate": issuedDate,
              "enrollments.$.certificateShortId": certificateShortId,
              "enrollments.$.certificateKey": certificate.certificateKey,
              "enrollments.$.issuedFlag": "Y"
            }
          }
        );

        // Success
        results.push({
          studentId,
          studentName: fullName,
          success: true,
          certificateId: certificateShortId
        });
      } catch (certError: any) {
        // Cleanup QR if still present
        if (qrCodeFilePath && fs.existsSync(qrCodeFilePath)) {
          try {
            fs.unlinkSync(qrCodeFilePath);
          } catch {
            /* empty */
          }
          qrCodeFilePath = null;
        }

        // Handle compound key collision specifically
        if (certError?.code === 11000 && certError?.keyPattern?.certificateShortId) {
          logger.error(`Certificate ID collision for student ${studentId}`, certError);
          results.push({
            studentId,
            studentName: fullName,
            success: false,
            error: "Certificate ID conflict, please retry"
          });
          continue;
        }

        // Rethrow anything else to the outer catch
        throw certError;
      }
    } catch (error: any) {
      // Cleanup QR on any outer failure
      if (qrCodeFilePath && fs.existsSync(qrCodeFilePath)) {
        try {
          fs.unlinkSync(qrCodeFilePath);
        } catch {
          // empty
        }
      }

      logger.error(`Certificate generation failed for student ${studentId}`, error);

      results.push({
        studentId,
        studentName, // always a string now — initialized as "Unknown" at top of loop
        success: false,
        error: error.message || "Certificate generation failed"
      });
    }
  }

  // 6. Summary
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  return {
    summary: {
      total: results.length,
      successful: successCount,
      failed: failureCount,
      allSuccessful: failureCount === 0
    },
    results
  };
};

const getCertificatesByClass = async (query: Record<string, string>, classId: string, organizationId: string) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const search = query.search?.trim();

  const searchStage = search
    ? {
        $or: [
          { "enrollments.certificateShortId": { $regex: search, $options: "i" } },
          { "enrollments.studentInfo.name": { $regex: search, $options: "i" } },
          { "enrollments.studentInfo.email": { $regex: search, $options: "i" } },
          { "enrollments.studentInfo.phone.number": { $regex: search, $options: "i" } },
          { "enrollments.studentInfo.USI": { $regex: search, $options: "i" } }
        ]
      }
    : {};

  const pipeline = [
    // ✅ added organizationId for tenant isolation
    {
      $match: {
        _id: new Types.ObjectId(classId),
        organizationId: new Types.ObjectId(organizationId)
      }
    },
    { $unwind: "$enrollments" },
    {
      $match: {
        "enrollments.certificateIssuedDate": { $ne: null },
        "enrollments.certificateId": { $ne: null, $type: "objectId" },
        "enrollments.certificateShortId": { $ne: null },
        "enrollments.certificateKey": { $ne: null },
        ...searchStage
      }
    },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          // ✅ moved $project inside $facet data branch — only runs on paginated docs
          {
            $project: {
              // ✅ removed non-existent "qualification: 0"
              "classDetails.closeDays": 0,
              "classDetails.location": 0,
              "classDetails.startDate": 0,
              "classDetails.endDate": 0,
              "classDetails.minParticipants": 0,
              "classDetails.maxParticipants": 0,
              "classDetails.classFee": 0,
              "classDetails.gst": 0,
              "classDetails.gstAmount": 0,
              "classDetails.defaultTrainer": 0,
              "classDetails.additionalTrainers": 0,
              "classDetails.vetInSchool": 0,
              "enrollments.unitsOfCompetency": 0,
              "enrollments.class": 0,
              reportingDetails: 0,
              fundDetails: 0,
              unitsInfo: 0
            }
          }
        ],
        meta: [{ $count: "total" }]
      }
    }
  ];

  const [result] = await ClassModel.aggregate(pipeline);

  const total = result.meta[0]?.total || 0;

  return {
    certificates: result.data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

const getIssuedCertificatesList = async (query: any, organizationId: string) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const searchRegex = query.search ? { $regex: query.search, $options: "i" } : null;

  const pipeline: any[] = [
    { $match: { organizationId: new Types.ObjectId(organizationId) } },
    {
      $lookup: {
        from: "classes",
        let: {
          studentId: { $toString: "$_id" },
          studentEmail: "$contactDetails.email"
        },
        pipeline: [
          { $unwind: "$enrollments" },
          {
            $match: {
              $expr: {
                $and: [
                  // added org scoping inside lookup
                  { $eq: ["$organizationId", new Types.ObjectId(organizationId)] },
                  {
                    $or: [
                      { $eq: ["$$studentId", "$enrollments.studentInfo.id"] },
                      { $eq: ["$$studentEmail", "$enrollments.studentInfo.email"] }
                    ]
                  }
                ]
              }
            }
          },
          {
            $match: {
              "enrollments.certificateShortId": { $ne: null }
            }
          },
          {
            $project: {
              _id: 0,
              class: {
                id: "$enrollments.class.id",
                title: "$enrollments.class.title",
                completionDate: "$enrollments.completionDate"
              },
              certificate: {
                certificateShortId: "$enrollments.certificateShortId",
                certificateIssueDate: "$enrollments.certificateIssuedDate",
                certificateKey: "$enrollments.certificateKey",
                certificateId: "$enrollments.certificateId"
              }
            }
          }
        ],
        as: "certificates"
      }
    },
    {
      $match: {
        "certificates.0": { $exists: true }
      }
    },
    { $unwind: "$certificates" },
    // fixed all wrong field paths — using raw model paths since this runs before $project
    ...(searchRegex
      ? [
          {
            $match: {
              $or: [
                { "certificates.certificate.certificateShortId": searchRegex }, // was missing
                { "personalInfo.givenName": searchRegex }, // was "givenName"
                { "personalInfo.surname": searchRegex }, // was "surname"
                { "participantsIdentifiers.USI": searchRegex }, // was "usi"
                { "contactDetails.email": searchRegex }, // already correct
                { "contactDetails.personalPhone.number": searchRegex }, // already correct
                { "certificates.class.title": searchRegex } // was "certificates.classTitle"
              ]
            }
          }
        ]
      : []),
    {
      $project: {
        _id: 0,
        student: {
          name: {
            givenName: "$personalInfo.givenName",
            surname: "$personalInfo.surname"
          },
          email: "$contactDetails.email",
          phone: "$contactDetails.personalPhone",
          usi: "$participantsIdentifiers.USI"
        },
        certificate: "$certificates.certificate",
        class: "$certificates.class"
      }
    },
    { $sort: { "certificate.certificateIssueDate": -1 } },
    { $skip: skip },
    { $limit: limit }
  ];

  // fixed fragile findIndex slice — explicitly exclude pagination and sort stages
  const countPipeline = [...pipeline.filter((p) => !p.$skip && !p.$limit && !p.$sort), { $count: "total" }];

  const [data, count] = await Promise.all([StudentModel.aggregate(pipeline), StudentModel.aggregate(countPipeline)]);

  const total = count[0]?.total || 0;

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

const verifyCertificate = async (id: string) => {
  const certificate = await CertificateModel.findOne({ certificateShortId: id })
    .populate({
      path: "studentId",
      model: "Student"
    })
    .populate({
      path: "classId",
      model: "classModel"
    });
  if (!certificate) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      DATA_NOT_FOUND.code,
      "We could not find a matching certificate record in Pro SMS!"
    );
  }
  return certificate;
};

const sendCertificateToStudentEmail = async ({ email, certificateId }: { email: string; certificateId: string }) => {
  const isCertificateExist = await CertificateModel.findById(certificateId);
  if (!isCertificateExist) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Certificate not found");
  }

  sendEmail({
    to: email,
    subject: "Course Completion Certificate - (CCC)",
    templateName: "onboardToken.template",
    templateData: {
      onboardUrl: isCertificateExist.certificateShortId
    }
  });
  return { url: isCertificateExist.certificateKey };
};

const deleteCertificate = async (id: string) => {
  const certificate = await CertificateModel.findById(id);

  if (!certificate) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Certificate not found");
  }

  // Remove from enrollment
  const updateResult = await ClassModel.updateOne(
    {
      _id: certificate.classId,
      "enrollments.certificateId": certificate._id
    },
    {
      $set: {
        "enrollments.$.certificateShortId": null,
        "enrollments.$.certificateIssuedDate": null,
        "enrollments.$.certificateKey": null,
        "enrollments.$.certificateId": null
      }
    }
  );

  if (updateResult.modifiedCount === 0) logger.warn("Enrollment cleanup failed");

  // Delete file
  await CloudflareService.deleteFileFromR2(certificate.certificateKey);

  // Delete certificate record
  await CertificateModel.findByIdAndDelete(id);
};

// E-01: Generate certificates for a single student across multiple class enrollments
const generateCertificatesForStudent = async (
  studentId: string,
  classIds: string[],
  templateId: string,
  organizationId: string
) => {
  const results: { classId: string; success: boolean; reason?: string }[] = [];

  for (const classId of classIds) {
    try {
      await generateCertificates(
        { classId, templateId, students: [{ id: studentId }] },
        organizationId
      );
      results.push({ classId, success: true });
    } catch (err: unknown) {
      const msg = err instanceof AppError ? err.message : "Unknown error";
      results.push({ classId, success: false, reason: msg });
    }
  }

  return results;
};

export const CertificateServices = {
  generateCertificates,
  generateCertificatesForStudent,
  getCertificatesByClass,
  verifyCertificate,
  sendCertificateToStudentEmail,
  getIssuedCertificatesList,
  deleteCertificate
};

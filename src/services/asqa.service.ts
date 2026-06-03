/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
// /* eslint-disable no-plusplus */
// // /* eslint-disable @typescript-eslint/no-explicit-any */
// // import exceljs from "exceljs";
// // import path from "path";
// // import fs from "fs";
// // import { ClassModel, UNIT_COMPETENCY_MAP } from "../model/class.model";
// // import { StudentModel } from "../model/student.model";
// // import { OrganizationModel } from "../model/organization.model";
// // import { ASQAReportModel } from "../model/asqa-report.model";
// // import { CloudflareService } from "./cloudflare.service";
// // import { differenceInMonths } from "date-fns";

// // /**
// //  * Helper to fetch base template
// //  */
// // const getTemplateBuffer = async (): Promise<Buffer> => {
// //   const templatePath = path.join(
// //     __dirname,
// //     "../../ASQA-reporting-template/delivery_data_and_student_survey_data_template.xlsx"
// //   );
// //   if (!fs.existsSync(templatePath)) {
// //     throw new Error("ASQA reporting template not found on the server.");
// //   }
// //   const fileBuffer = fs.readFileSync(templatePath);
// //   return fileBuffer.buffer.slice(
// //     fileBuffer.byteOffset,
// //     fileBuffer.byteOffset + fileBuffer.byteLength
// //   ) as unknown as Buffer;
// // };

// // export const generateASQAReport = async (
// //   organizationId: string,
// //   reportType: "ALL" | "DELIVERY_DATA" | "STUDENT_SURVEY" | "ENROLLMENTS",
// //   startDate: string,
// //   endDate: string,
// //   completedBy: string
// // ) => {
// //   const start = new Date(startDate);
// //   const end = new Date(endDate);

// //   // 1. Load Workbook
// //   const templateBuffer = await getTemplateBuffer();
// //   const workbook = new exceljs.Workbook();
// //   // Using `any` cast to bypass strict Buffer prototype checks from AWS SDK / TS dom lib conflicts
// //   await workbook.xlsx.load(templateBuffer as any);

// //   // Helper arrays for data to process
// //   let deliveryData: any[] = [];
// //   const enrollmentData: any[] = [];
// //   let surveyData: any[] = [];

// //   // Determine Reporting Windows
// //   const totalMonthsSelected = differenceInMonths(end, start);
// //   let enrollmentStartDate = start;
// //   if (totalMonthsSelected >= 6) {
// //     enrollmentStartDate = new Date(end);
// //     enrollmentStartDate.setMonth(enrollmentStartDate.getMonth() - 6);
// //   }

// //   // --- Fetch Data Logic ---
// //   if (["ALL", "DELIVERY_DATA"].includes(reportType)) {
// //     const classes = await ClassModel.find({
// //       organizationId,
// //       "classDetails.startDate": { $lte: end },
// //       "classDetails.endDate": { $gte: start }
// //     }).populate("qualificationId");

// //     // Process Delivery Data (grouped by Qualification)
// //     // Structure expected:
// //     // row[2] = Code, row[3] = Title, row[4] = Current Enrolments
// //     // row[5] = AQF Issued last 12 months, row[6] = Principal Funding
// //     // row[7] = Venues, row[8] = Mode, row[9] = Partnership, row[10] = Cohort

// //     const qualMap = new Map();
// //     // Simplified grouping logic:
// //     for (const c of classes) {
// //       const q: any = c.qualificationId;
// //       if (!q) continue;

// //       if (!qualMap.has(q.code)) {
// //         qualMap.set(q.code, {
// //           code: q.code,
// //           title: q.title,
// //           currentEnrolls: 0,
// //           issued: 0,
// //           funding: c.fundDetails?.principleFundingSourceAsqa || "",
// //           venues: new Set([c.classDetails?.location]),
// //           mode: c.reportingDetails?.avetmissDeliveryMode || "Unknown"
// //         });
// //       }

// //       const qData = qualMap.get(q.code);
// //       if (c.classDetails?.location) qData.venues.add(c.classDetails.location);

// //       c.enrollments?.forEach((enr: any) => {
// //         // Current Enrolment
// //         const enrStart = new Date(enr.enrollmentDate);
// //         if (enrStart <= end && !enr.completionDate) {
// //           qData.currentEnrolls += 1;
// //         }

// //         // Issued
// //         if (
// //           enr.certificateIssuedDate &&
// //           new Date(enr.certificateIssuedDate) >= start &&
// //           new Date(enr.certificateIssuedDate) <= end
// //         ) {
// //           qData.issued += 1;
// //         }
// //       });
// //     }

// //     deliveryData = Array.from(qualMap.values());
// //   }

// //   // --- Empty Data Guard ---
// //   // Throw early if there's nothing to report for the requested type
// //   if (reportType === "DELIVERY_DATA" && deliveryData.length === 0) {
// //     throw Object.assign(new Error("No qualifying delivery data found in the selected date range."), { status: 404 });
// //   }

// //   if (["ALL", "ENROLLMENTS"].includes(reportType)) {
// //     // Find unit completions within the shorter window (max 6 months)
// //     const activeClasses = await ClassModel.find({
// //       organizationId,
// //       "enrollments.unitsOfCompetency.unitCompletionDate": {
// //         $gte: enrollmentStartDate,
// //         $lte: end
// //       }
// //     }).populate("qualificationId");

// //     const unitPromises: Promise<void>[] = [];
// //     for (const c of activeClasses) {
// //       const q: any = c.qualificationId;
// //       const venue = c.classDetails?.location || "";

// //       for (const enr of c.enrollments) {
// //         for (const u of enr.unitsOfCompetency) {
// //           if (
// //             u.unitCompletionDate &&
// //             new Date(u.unitCompletionDate) >= enrollmentStartDate &&
// //             new Date(u.unitCompletionDate) <= end
// //           ) {
// //             unitPromises.push(
// //               (async () => {
// //                 const student = await StudentModel.findById(enr.studentInfo.id);
// //                 if (!student) return;

// //                 const statusLabel =
// //                   UNIT_COMPETENCY_MAP[u.statusOfCompletion as keyof typeof UNIT_COMPETENCY_MAP]?.meaning ||
// //                   u.statusOfCompletion;

// //                 enrollmentData.push({
// //                   firstName: student.personalInfo.givenName,
// //                   lastName: student.personalInfo.surname,
// //                   dob: student.personalInfo.dateOfBirth,
// //                   studentId: student._id.toString(), // Internal logic reference
// //                   phone: student.contactDetails.personalPhone?.number || "",
// //                   qual: `${q?.code || ""} - ${q?.title || ""}`,
// //                   unit: `${u.code} - ${u.title}`,
// //                   start: u.unitStartDate || u.classStartDate,
// //                   end: u.unitCompletionDate || u.classEndDate,
// //                   site: venue,
// //                   status: statusLabel
// //                 });
// //               })()
// //             );
// //           }
// //         }
// //       }
// //     }
// //     await Promise.all(unitPromises);

// //     if (reportType === "ENROLLMENTS" && enrollmentData.length === 0) {
// //       throw Object.assign(new Error("No unit completions found in the selected date range (last 6 months of range)."), {
// //         status: 404
// //       });
// //     }
// //   }

// //   if (["ALL", "STUDENT_SURVEY"].includes(reportType)) {
// //     // Unique students enrolled or completed anything in the full window
// //     const activeClasses = await ClassModel.find({
// //       organizationId,
// //       $or: [
// //         { "enrollments.enrollmentDate": { $gte: start, $lte: end } },
// //         { "enrollments.completionDate": { $gte: start, $lte: end } }
// //       ]
// //     }).populate("qualificationId");

// //     const uniqueStudentsMap = new Map();

// //     const currPromises: Promise<void>[] = [];
// //     for (const c of activeClasses) {
// //       const q: any = c.qualificationId;
// //       for (const enr of c.enrollments) {
// //         const checkStart = new Date(enr.enrollmentDate);
// //         let valid = false;
// //         if (checkStart >= start && checkStart <= end) valid = true;
// //         if (enr.completionDate) {
// //           const checkEnd = new Date(enr.completionDate);
// //           if (checkEnd >= start && checkEnd <= end) valid = true;
// //         }

// //         if (valid && !uniqueStudentsMap.has(enr.studentInfo.id)) {
// //           currPromises.push(
// //             (async () => {
// //               const student = await StudentModel.findById(enr.studentInfo.id);
// //               if (student) {
// //                 uniqueStudentsMap.set(enr.studentInfo.id, {
// //                   code: q?.code || "",
// //                   title: q?.title || "",
// //                   firstName: student.personalInfo.givenName,
// //                   lastName: student.personalInfo.surname,
// //                   phone: student.contactDetails.personalPhone?.number || "",
// //                   email: student.contactDetails.email || "",
// //                   enrDate: enr.enrollmentDate,
// //                   compDate: enr.completionDate || "N/A"
// //                 });
// //               }
// //             })()
// //           );
// //         }
// //       }
// //     }
// //     await Promise.all(currPromises);

// //     surveyData = Array.from(uniqueStudentsMap.values());

// //     if (reportType === "STUDENT_SURVEY" && surveyData.length === 0) {
// //       throw Object.assign(new Error("No student enrolment/completion activity found in the selected date range."), {
// //         status: 404
// //       });
// //     }

// //     if (surveyData.length > 1000) {
// //       surveyData.sort((a, b) => a.lastName.localeCompare(b.lastName));
// //       surveyData = surveyData.slice(0, 1000);
// //     }
// //   }

// //   // Final check for ALL: at least one data set must be non-empty
// //   if (reportType === "ALL" && deliveryData.length === 0 && enrollmentData.length === 0 && surveyData.length === 0) {
// //     throw Object.assign(new Error("No data found in the selected date range for any ASQA sheet."), { status: 404 });
// //   }

// //   // --- Populate Excel Sheets ---

// //   if (["ALL", "DELIVERY_DATA"].includes(reportType)) {
// //     const sheet = workbook.getWorksheet("Delivery Data Summary");
// //     if (sheet) {
// //       // Fetch real RTO info from the organizations collection
// //       const org = await OrganizationModel.findOne({ _id: organizationId }).lean();
// //       const rtoName = org?.name || "";
// //       const rtoId = org?.rtoId || "";

// //       // Row 3: "RTO Legal Name:" label is in cols B-C (merged), value goes in cols D-H (next merged block)
// //       // Row 3: "RTO ID Number:" label is in cols I-J,  value goes in col K
// //       // Row 4: "Completed By:" label in cols B-C,      value goes in cols D-H
// //       // Row 4: "Date:"         label in cols I-J,       value goes in col K
// //       sheet.getCell("D3").value = rtoName;
// //       sheet.getCell("K3").value = rtoId;
// //       sheet.getCell("D4").value = completedBy;
// //       sheet.getCell("K4").value = end; // Report end date

// //       let rowIndex = 10; // Table A usually starts around row 10 based on structure
// //       for (const item of deliveryData) {
// //         const row = sheet.getRow(rowIndex);
// //         row.getCell(2).value = item.code;
// //         row.getCell(3).value = item.title;
// //         row.getCell(4).value = item.currentEnrolls;
// //         row.getCell(5).value = item.issued;
// //         row.getCell(6).value = item.funding;
// //         row.getCell(7).value = Array.from(item.venues).join(", ");
// //         row.getCell(8).value = item.mode;
// //         row.getCell(9).value = "No"; // Subcontract
// //         row.getCell(10).value = "General"; // Cohort
// //         row.commit();
// //         rowIndex += 1;
// //       }
// //     }
// //   } else {
// //     // Remove if not requested
// //     workbook.removeWorksheet("Delivery Data Summary");
// //   }

// //   if (["ALL", "ENROLLMENTS"].includes(reportType)) {
// //     const sheet = workbook.getWorksheet("Enrolment and Completion Data");
// //     if (sheet) {
// //       // Row 3: RTO details, Row 5 starts table
// //       let rowIndex = 5;
// //       for (const item of enrollmentData) {
// //         const row = sheet.getRow(rowIndex);
// //         row.getCell(2).value = item.firstName;
// //         row.getCell(3).value = item.lastName;
// //         row.getCell(4).value = item.dob;
// //         row.getCell(5).value = item.studentId;
// //         row.getCell(6).value = item.phone;
// //         row.getCell(7).value = item.qual;
// //         row.getCell(8).value = item.unit;
// //         row.getCell(9).value = item.start;
// //         row.getCell(10).value = item.end;
// //         row.getCell(11).value = item.site;
// //         row.getCell(12).value = item.status;
// //         row.commit();
// //         rowIndex += 1;
// //       }
// //     }
// //   } else {
// //     workbook.removeWorksheet("Enrolment and Completion Data");
// //   }

// //   if (["ALL", "STUDENT_SURVEY"].includes(reportType)) {
// //     const sheet = workbook.getWorksheet("Student Survey data");
// //     if (sheet) {
// //       let rowIndex = 5;
// //       for (const item of surveyData) {
// //         const row = sheet.getRow(rowIndex);
// //         row.getCell(2).value = item.code;
// //         row.getCell(3).value = item.title;
// //         row.getCell(4).value = item.firstName;
// //         row.getCell(5).value = item.lastName;
// //         row.getCell(6).value = item.phone;
// //         row.getCell(7).value = item.enrDate;
// //         row.getCell(8).value = item.compDate;
// //         row.getCell(9).value = item.email;
// //         row.commit();
// //         rowIndex += 1;
// //       }
// //     }
// //   } else {
// //     workbook.removeWorksheet("Student Survey data");
// //   }

// //   // --- Save & Upload to R2 ---
// //   const generatedXlsxBuffer = await workbook.xlsx.writeBuffer();
// //   // Ensure strict Buffer conversion for Cloudflare SDK
// //   const generatedBuffer = Buffer.from(generatedXlsxBuffer);

// //   const fileName = `ASQA_Report_${reportType}_${Date.now()}.xlsx`;

// //   const uploadResult = await CloudflareService.uploadBufferToR2(
// //     generatedBuffer,
// //     fileName,
// //     "asqa-reports",
// //     true // Ensure downloadable
// //   );

// //   if (!uploadResult.success) {
// //     throw new Error(`Failed to upload ASQA report to Cloudflare R2: ${uploadResult.message}`);
// //   }

// //   // --- Save to DB ---
// //   const record = await ASQAReportModel.create({
// //     organizationId,
// //     reportType,
// //     startDate: start,
// //     endDate: end,
// //     completedBy,
// //     fileUrl: uploadResult.publicUrl,
// //     fileKey: uploadResult.key
// //   });

// //   return record;
// // };

// // // --- GET Method (Paginated History) ---
// // export const getASQAReports = async (
// //   organizationId: string,
// //   page: number = 1,
// //   limit: number = 10,
// //   startFilt?: string,
// //   endFilt?: string
// // ) => {
// //   const query: any = { organizationId };
// //   if (startFilt) {
// //     query.createdAt = { ...query.createdAt, $gte: new Date(startFilt) };
// //   }
// //   if (endFilt) {
// //     query.createdAt = { ...query.createdAt, $lte: new Date(endFilt) };
// //   }

// //   const skip = (page - 1) * limit;

// //   const [reports, total] = await Promise.all([
// //     ASQAReportModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
// //     ASQAReportModel.countDocuments(query)
// //   ]);

// //   return {
// //     reports,
// //     total,
// //     page,
// //     limit,
// //     totalPages: Math.ceil(total / limit)
// //   };
// // };

// // export const ASQAService = {
// //   generateASQAReport,
// //   getASQAReports
// // };

/* eslint-disable @typescript-eslint/no-explicit-any */
import ExcelJS from "exceljs";
import { ClassModel } from "../model/class.model";
import { StudentModel } from "../model/student.model";
import { AppError } from "../utils/appError";
import { DATA_NOT_FOUND, ENROLLED_UNIT_COMPLETED_STATUSES, httpStatus } from "../constants";
import { OrganizationModel } from "../model/organization.model";
import { ASQAReportParams, SurveyEntry, UnitAgg } from "../types/asqa-report.type";
import { generateSequentialId } from "../utils/sequentialIdGenerator";
import { CloudflareService } from "./cloudflare.service";
import { ASQAReportModel } from "../model/asqa-report.model";
import { QueryBuilder } from "../utils/queryBuilder";
import archiver from "archiver";
import axios from "axios";
import { Readable } from "stream";
import { Response } from "express";
import { LocationT } from "../schemas/location.schema";

// ─── Colors (matched from screenshots) ────────────────────────────────────────
// Sheet 1 & 2 row-1 background: orange/salmon
const COLOR_ORANGE_HEADER = "FFF4B183"; // orange salmon — row 1 title background
const COLOR_BLUE_SUBHEADER = "FFD9E1F2"; // light blue — column header background (sheet 1 & 2)
const COLOR_GREEN_HEADER = "FF9DC3A4"; // green-ish — Table A/B title band (sheet 1)
const COLOR_WHITE = "FFFFFFFF";
const COLOR_BLACK = "FF000000";
const COLOR_RED = "FFFF0000";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const getEnrollmentDateRange = (startDate: Date, endDate: Date): { start: Date; end: Date } => {
  // Safe 6-month subtraction: use day-of-month clamping to avoid JS rollover bug.
  // e.g. Aug 31 - 6 months via setMonth(1) rolls to Mar 3 because Feb 31 doesn't exist.
  const sixMonthsBeforeEnd = new Date(endDate);
  const targetMonth = sixMonthsBeforeEnd.getMonth() - 6;
  sixMonthsBeforeEnd.setDate(1); // clamp to 1st first to avoid overflow
  sixMonthsBeforeEnd.setMonth(targetMonth);
  // Set to last day of that month to be inclusive
  const lastDay = new Date(sixMonthsBeforeEnd.getFullYear(), sixMonthsBeforeEnd.getMonth() + 1, 0).getDate();
  sixMonthsBeforeEnd.setDate(Math.min(new Date(endDate).getDate(), lastDay));
  const start = sixMonthsBeforeEnd > startDate ? sixMonthsBeforeEnd : startDate;
  return { start, end: endDate };
};

const formatLocation = (loc: LocationT): string => {
  if (!loc || typeof loc !== "object") return "";
  const parts = [
    loc.addressLine,
    loc.building,
    loc.unit,
    loc.street,
    loc.POBox,
    loc.city,
    loc.state,
    loc.postcode,
    loc.country
  ].filter((p) => p && String(p).trim() !== "");
  return parts.join(", ");
};

/**
 * Resolve delivery venues for a class.
 */
const resolveLocations = (cls: any): string[] => {
  const results: string[] = [];

  // Primary location — always present
  const primary = cls.classDetails?.location;
  if (primary && typeof primary === "object") {
    const formatted = formatLocation(primary);
    if (formatted) results.push(formatted);
  }

  // Additional locations — optional, append if present
  const additional: any[] = (cls.classDetails?.additionalLocations || []).filter(
    (l: any) => l && typeof l === "object"
  );
  additional.forEach((l) => {
    const formatted = formatLocation(l);
    if (formatted) results.push(formatted);
  });

  // console.log({ primary, additional });

  return results;
};

// ─── Data Fetcher
const fetchClassesInRange = async (organizationId: string, startDate: Date, endDate: Date) => {
  return ClassModel.find({
    organizationId,
    "classDetails.startDate": { $lte: endDate },
    "classDetails.endDate": { $gte: startDate }
  })
    .populate({ path: "qualificationId", model: "Qualification" })
    .populate({ path: "classDetails.location", model: "Location" })
    .populate({ path: "classDetails.additionalLocations", model: "Location" });
};

// ─── Sheet 1: Delivery Data Summary
const buildDeliveryDataSheet = (
  wb: ExcelJS.Workbook,
  params: ASQAReportParams & { rtoName: string; rtoId: string },
  classes: any[]
) => {
  const ws = wb.addWorksheet("Delivery Data Summary");
  const TABLE_COLS = 10; // A–J

  ws.columns = [
    { width: 16 }, // A Code
    { width: 40 }, // B Title
    { width: 14 }, // C Enrolments
    { width: 16 }, // D AQF Issued
    { width: 30 }, // E Funding Source
    { width: 110 }, // F Delivery Venues
    { width: 30 }, // G Delivery Mode
    { width: 16 }, // H Partnership
    { width: 24 }, // I Client Cohort
    { width: 30 } // J Comments
  ];

  // ── Row 1: Orange title — only A:J colored
  ws.mergeCells("A1:J1");
  ws.getCell("A1").value =
    "ASQA Delivery Data Summary Sheet for completion by Registered Training Organisations (RTOs)";
  ws.getCell("A1").font = { bold: true, size: 12, color: { argb: COLOR_BLACK } };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ORANGE_HEADER } };
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  // ── Row 2: Subtitle — only A:J colored
  ws.mergeCells("A2:J2");
  ws.getCell("A2").value =
    "Complete this data sheet to summarise enrolments and completions for the previous 12 months.";
  ws.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 18;

  // ── Row 3: RTO Legal Name + RTO ID
  ws.getCell("A3").value = "RTO Legal Name:";
  ws.getCell("A3").font = { bold: true };
  ws.mergeCells("B3:H3");
  ws.getCell("B3").value = params.rtoName;
  ws.getCell("I3").value = "RTO ID Number:";
  ws.getCell("I3").font = { bold: true };
  ws.getCell("J3").value = params.rtoId;
  ws.getRow(3).height = 18;

  // ── Row 4: Completed By + Date
  ws.getCell("A4").value = "Completed By:";
  ws.getCell("A4").font = { bold: true };
  ws.mergeCells("B4:H4");
  ws.getCell("B4").value = params.generatedBy;
  ws.getCell("I4").value = "Date completed:";
  ws.getCell("I4").font = { bold: true };
  ws.getCell("J4").value = formatDate(new Date());
  ws.getRow(4).height = 18;

  // ── Row 5: Blank separator
  ws.getRow(5).height = 8;

  // ── Row 6: Instructions — ONE merged tall cell, bright navy blue text ─────
  ws.mergeCells("A6:J6");
  ws.getCell("A6").value =
    "Instructions for RTO\n" +
    "o Use Table A to record enrolment and completion activity where a student has enrolled to complete a full qualification or accredited course.\n" +
    "o Use Table B to record enrolment and completion activity where a student has enrolled to complete individual units of competency only (i.e. not a full qualification or accredited course).\n" +
    "o Complete all columns and add rows where necessary.\n" +
    "o Your RTO's scope listing can be cut and pasted from the National Register {www.training.gov.au} into the tables below";
  ws.getCell("A6").font = { size: 10, color: { argb: "FF1F3864" } }; // bright navy blue
  ws.getCell("A6").alignment = { wrapText: true, vertical: "top" };
  ws.getRow(6).height = 85;

  // ── Row 7: Blank separator ────────────────────────────────────────────────
  ws.getRow(7).height = 8;

  // ── Row 8: Table A title — only A:J colored ───────────────────────────────
  ws.mergeCells("A8:J8");
  ws.getCell("A8").value = "Table A - Full qualifications/accredited courses";
  ws.getCell("A8").font = { bold: true, size: 11, color: { argb: COLOR_BLACK } };
  ws.getCell("A8").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_GREEN_HEADER } };
  ws.getCell("A8").alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(8).height = 22;

  // ── Row 9: Table A column headers — hint text embedded in same cell, A:J only
  const HINT_FONT = { size: 8, color: { argb: COLOR_BLACK } };
  const BOLD_FONT = { bold: true, size: 10, color: { argb: COLOR_BLACK } };

  const tableAHeaderRow = ws.addRow([]);
  tableAHeaderRow.height = 130;

  const tableAHeaders: { bold: string; hint?: string }[] = [
    { bold: "Code" },
    { bold: "Title of qualification or accredited course" },
    { bold: "Number of current enrolments" },
    { bold: "Number of AQF Qualifications issued within the past 12 months" },
    {
      bold: "Principal Funding Source",
      hint: "List the principal revenue source from these categories -\no Fee for Service- Domestic (FFSD)\no Fee for Service- International (FFSI)\no Government funding (GF)\no VET Student Loans (VSL)"
    },
    {
      bold: "Regular Delivery Venues",
      hint: "List as many as relevant, citing suburb/town and state/territory/country"
    },
    {
      bold: "Principal Delivery Mode",
      hint: "List the principal delivery mode from these categories -\no Face to face (workplace)\no Face to face (RTO premise)\no Online\no Distance"
    },
    { bold: "Partnership / Subcontract Arrangements\n\nYes / No" },
    {
      bold: "Principal Client Cohort",
      hint: "Identify the principal cohort from this list -\no Apprentices/trainees\no School-based\no Skilled workers\no Unskilled job seekers\no Visa holders"
    },
    { bold: "Comments" }
  ];

  tableAHeaders.forEach(({ bold, hint }, i) => {
    const cell = tableAHeaderRow.getCell(i + 1);
    cell.value = hint
      ? {
          richText: [
            { text: bold + "\n", font: BOLD_FONT },
            { text: hint, font: HINT_FONT }
          ]
        }
      : { richText: [{ text: bold, font: BOLD_FONT }] };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_BLUE_SUBHEADER } };
    cell.alignment = { wrapText: true, vertical: "top", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });

  // E-05: split by programType. programType is stored in reportingDetails (not classDetails).
  // Default (unset / FULL_QUAL) → Table A. "SOA" → Table B.
  const fullQualClasses = classes.filter(
    (cls: any) => !cls.reportingDetails?.doNotReportAsqa && cls.reportingDetails?.programType !== "SOA"
  );
  const soaClasses = classes.filter(
    (cls: any) => !cls.reportingDetails?.doNotReportAsqa && cls.reportingDetails?.programType === "SOA"
  );

  // ── Table A data rows — full qualifications/accredited courses ────────────
  for (const cls of fullQualClasses) {
    const qual = cls.qualificationId as any;

    // Exclude SOA enrollments from Table A counts (they go to Table B)
    const fullEnrollments = (cls.enrollments || []).filter((e: any) => e.enrollmentType !== "SOA");
    const enrollmentsInRange = fullEnrollments.filter((e: any) => {
      const d = new Date(e.enrollmentDate);
      return d >= params.startDate && d <= params.endDate;
    });

    const aqfIssued = fullEnrollments.filter((e: any) => {
      if (!e.certificateIssuedDate) return false;
      const d = new Date(e.certificateIssuedDate);
      return d >= params.startDate && d <= params.endDate;
    }).length;

    const locations = resolveLocations(cls);
    const row = ws.addRow([
      qual?.code || "",
      qual?.title || cls.classDetails?.classTitle || "",
      enrollmentsInRange.length,
      aqfIssued,
      cls.fundDetails?.principleFundingSourceAsqa || "",
      locations.join("\n"),
      cls.reportingDetails?.deliveryLocation || "",
      cls.reportingDetails?.partnership ? "Yes" : "No",
      cls.reportingDetails?.principalClientCohort || "",
      cls.reportingDetails?.comment || ""
    ]);
    row.alignment = { wrapText: true, vertical: "top" };
    row.height = locations.length > 1 ? locations.length * 30 : 20; // ← dynamic height
    for (let col = 1; col <= TABLE_COLS; col++) {
      row.getCell(col).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    }
  }

  // ── Blank spacer ─────────────────────────────────────────────────────────
  ws.addRow([]).height = 8;
  ws.addRow([]).height = 8;

  // ── Table B title — only A:J colored ─────────────────────────────────────
  const tableBTitleRowNum = ws.rowCount + 1;
  ws.mergeCells(`A${tableBTitleRowNum}:J${tableBTitleRowNum}`);
  ws.getCell(`A${tableBTitleRowNum}`).value = "Table B - Units of competency";
  ws.getCell(`A${tableBTitleRowNum}`).font = { bold: true, size: 11, color: { argb: COLOR_BLACK } };
  ws.getCell(`A${tableBTitleRowNum}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLOR_GREEN_HEADER }
  };
  ws.getCell(`A${tableBTitleRowNum}`).alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(tableBTitleRowNum).height = 22;

  // ── Table B column headers — hint text embedded in same cell, A:J only ────
  const tableBHeaderRow = ws.addRow([]);
  tableBHeaderRow.height = 130;

  const tableBHeaders: { bold: string; hint?: string }[] = [
    { bold: "Code" },
    { bold: "Title of unit of competency listed explicitly on scope" },
    { bold: "Number of current enrolments" },
    { bold: "Number of AQF Statements of Attainment issued  within the past 12 months" },
    {
      bold: "Principal Revenue Source",
      hint: "List the principal revenue source from these categories -\no Fee for Service- Domestic (FFSD)\no Fee for Service- International (FFSI)\no Government funding (GF)\no VET Student Loans (VSL)"
    },
    {
      bold: "Regular Delivery Venues",
      hint: "List as many as relevant, citing the suburb/town and the state/territory/country"
    },
    {
      bold: "Principal Delivery Mode",
      hint: "List the principal delivery mode from these categories -\no Face-to-face (workplace)\no Face to face (RTO premise)\no Online\no Distance"
    },
    { bold: "Partnership / Subcontract Arrangements\n\nYes / No" },
    {
      bold: "Principal Client Cohort",
      hint: "Identify the principal cohort from this list -\no Apprentices/trainees\no School-based\no Skilled workers\no Unskilled job seekers\no Visa holders"
    },
    { bold: "Comments" }
  ];

  tableBHeaders.forEach(({ bold, hint }, i) => {
    const cell = tableBHeaderRow.getCell(i + 1);
    cell.value = hint
      ? {
          richText: [
            { text: bold + "\n", font: BOLD_FONT },
            { text: hint, font: HINT_FONT }
          ]
        }
      : { richText: [{ text: bold, font: BOLD_FONT }] };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_BLUE_SUBHEADER } };
    cell.alignment = { wrapText: true, vertical: "top", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });

  // ── Table B data: aggregate units by unit code ───────────────────────────
  // Sources: (a) entire SOA class, (b) individual enrollments in FULL_QUAL classes
  //          where the student chose enrollmentType === "SOA".
  const unitMap = new Map<string, UnitAgg>();

  const aggregateUnitsFromEnrollment = (cls: any, enrollment: any) => {
    const locs = resolveLocations(cls);
    const enrollDate = new Date(enrollment.enrollmentDate);
    const inRange = enrollDate >= params.startDate && enrollDate <= params.endDate;
    for (const unit of enrollment.unitsOfCompetency || []) {
      if (!unitMap.has(unit.code)) {
        unitMap.set(unit.code, {
          code: unit.code, title: unit.title, enrollmentCount: 0, issuedCount: 0,
          locations: new Set(), fundingSources: new Set(), deliveryModes: new Set(),
          hasPartnership: false, cohorts: new Set(), comments: new Set()
        });
      }
      const agg = unitMap.get(unit.code)!;
      if (inRange) { agg.enrollmentCount++; if (unit.statusOfCompletion === "C") agg.issuedCount++; }
      locs.forEach((l) => agg.locations.add(l));
      if (cls.fundDetails?.principleFundingSourceAsqa) agg.fundingSources.add(cls.fundDetails.principleFundingSourceAsqa);
      if (cls.reportingDetails?.principleDeliveryMode) agg.deliveryModes.add(cls.reportingDetails.principleDeliveryMode);
      if (cls.reportingDetails?.partnership) agg.hasPartnership = true;
      if (cls.reportingDetails?.principalClientCohort) agg.cohorts.add(cls.reportingDetails.principalClientCohort);
      if (cls.reportingDetails?.comment) agg.comments.add(cls.reportingDetails.comment);
    }
  };

  // (a) SOA classes — all enrollments go to Table B
  for (const cls of soaClasses) {
    for (const enrollment of cls.enrollments || []) {
      aggregateUnitsFromEnrollment(cls, enrollment);
    }
  }

  // (b) FULL_QUAL classes — only enrollments where student chose enrollmentType === "SOA"
  for (const cls of fullQualClasses) {
    for (const enrollment of (cls.enrollments || []).filter((e: any) => e.enrollmentType === "SOA")) {
      aggregateUnitsFromEnrollment(cls, enrollment);
    }
  }

  for (const agg of unitMap.values()) {
    const row = ws.addRow([
      agg.code,
      agg.title,
      agg.enrollmentCount,
      agg.issuedCount,
      Array.from(agg.fundingSources).join(", "),
      Array.from(agg.locations).join("\n"),
      Array.from(agg.deliveryModes).join(", "),
      agg.hasPartnership ? "Yes" : "No",
      Array.from(agg.cohorts).join(", "),
      Array.from(agg.comments).join("; ")
    ]);
    row.alignment = { wrapText: true, vertical: "top" };
    // row.height = 20;
    row.height = agg.locations.size > 1 ? agg.locations.size * 30 : 20; // ← dynamic height
    for (let col = 1; col <= TABLE_COLS; col++) {
      row.getCell(col).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    }
  }
};

// ─── Sheet 2: Student Survey Data ────────────────────────────────────────────
const buildStudentSurveySheet = (wb: ExcelJS.Workbook, params: ASQAReportParams, classes: any[]) => {
  const ws = wb.addWorksheet("Student Survey data");
  const TABLE_COLS = 8; // A–H

  ws.columns = [
    { width: 18 }, // A Program identifier
    { width: 38 }, // B Program name
    { width: 20 }, // C First given name
    { width: 20 }, // D Last name
    { width: 22 }, // E Telephone
    { width: 16 }, // F Activity start date
    { width: 16 }, // G Activity end date
    { width: 34 } // H Email address
  ];

  // ── Row 1: Orange title — only A:H colored ────────────────────────────────
  ws.mergeCells("A1:H1");
  ws.getCell("A1").value =
    "ASQA Student Survey Data Collection Sheet for completion by Registered Training Organisations (RTOs)";
  ws.getCell("A1").font = { bold: true, size: 12, color: { argb: COLOR_BLACK } };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ORANGE_HEADER } };
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  // ── Row 2: Instructions ───────────────────────────────────────────────────
  ws.mergeCells("A2:H2");
  ws.getCell("A2").value =
    "Instructions: Provide details below for all students who have enrolled and/or have completed any training product " +
    "in the past 12 months - where this is less than 1000 unique students.\n\n" +
    "Where your RTO has had more than 1000 enrolments or completions in the past 12 months, please provide a sample " +
    "across all training products on your scope where enrolments of completions have occured to equal 1000 unique students " +
    "(to ensure sample is random, please populate the sample by selecting students with a surname starting with A to Z - " +
    "to achieve the desired number for each training program)\n\n" +
    "Unique student means each student listed below is unique - as we only want to send them one survey invite. " +
    "For example, if one student has enrolled and/or completed two different training products with your organisation " +
    "in the past 12 months, that student should only be listed once below against one of the training products. " +
    "To assist in identifying if student details are unique, Column E (Mobile number) and Column H (student email address) " +
    "and will highlight red if duplicate values are identified.";
  ws.getCell("A2").font = { size: 10, color: { argb: COLOR_BLACK } };
  ws.getCell("A2").alignment = { wrapText: true, vertical: "top" };
  ws.getRow(2).height = 120;

  // ── Row 3: Column headers — only A:H colored ─────────────────────────────
  const colHeaderRow = ws.addRow([
    "Program\nidentifier",
    "Program name",
    "Client first given\nname",
    "Client last name",
    "Telephone number\n- mobile",
    "Activity start\ndate",
    "Activity end\ndate",
    "Email address"
  ]);
  colHeaderRow.font = { bold: true, size: 10, color: { argb: COLOR_BLACK } };
  colHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_BLUE_SUBHEADER } };
  colHeaderRow.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
  colHeaderRow.height = 40;
  for (let col = 1; col <= TABLE_COLS; col++) {
    colHeaderRow.getCell(col).border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  }

  // ── Build unique student map ──────────────────────────────────────────────

  const studentMap = new Map<string, SurveyEntry>();

  for (const cls of classes) {
    // E-05: skip classes opted out of ASQA reporting
    if ((cls as any).reportingDetails?.doNotReportAsqa) continue;

    const qual = cls.qualificationId as any;
    for (const enrollment of cls.enrollments || []) {
      const enrollDate = new Date(enrollment.enrollmentDate);
      if (enrollDate < params.startDate || enrollDate > params.endDate) continue;

      const email = (enrollment.studentInfo?.email || "").toLowerCase().trim();
      if (!email) continue;

      const existing = studentMap.get(email);
      if (existing && enrollDate <= existing.enrollmentDate) continue;

      const fullName: string = enrollment.studentInfo?.name || "";
      const nameParts = fullName.trim().split(/\s+/);
      const givenName = nameParts[0] || "";
      const surname = nameParts.slice(1).join(" ") || "";

      studentMap.set(email, {
        qualCode: qual?.code || "",
        qualTitle: qual?.title || "",
        givenName,
        surname,
        phone: enrollment.studentInfo?.phone?.number || "",
        enrollmentDate: enrollDate,
        completionDate: enrollment.completionDate ? new Date(enrollment.completionDate) : null,
        email
      });
    }
  }

  // Sort A–Z by surname, cap at 1000
  let students = Array.from(studentMap.values()).sort((a, b) => a.surname.localeCompare(b.surname));
  students = students.slice(0, 1000);

  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();

  for (const s of students) {
    const isDupEmail = seenEmails.has(s.email);
    const isDupPhone = s.phone ? seenPhones.has(s.phone) : false;

    const row = ws.addRow([
      s.qualCode,
      s.qualTitle,
      s.givenName,
      s.surname,
      s.phone,
      formatDate(s.enrollmentDate),
      formatDate(s.completionDate),
      s.email
    ]);

    row.alignment = { vertical: "top" };
    row.height = 18;
    for (let col = 1; col <= TABLE_COLS; col++) {
      row.getCell(col).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    }

    if (isDupPhone) {
      row.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_RED } };
      row.getCell(5).font = { color: { argb: COLOR_WHITE }, bold: true };
    }
    if (isDupEmail) {
      row.getCell(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_RED } };
      row.getCell(8).font = { color: { argb: COLOR_WHITE }, bold: true };
    }

    seenEmails.add(s.email);
    if (s.phone) seenPhones.add(s.phone);
  }
};

const buildEnrollmentCompletionSheet = async (
  wb: ExcelJS.Workbook,
  params: ASQAReportParams & { rtoName: string },
  classes: any[],
  studentDataMap: Map<string, { dob: string; studentId: string; phone: string }>
) => {
  const ws = wb.addWorksheet("Enrolment and Completion Data");

  ws.columns = [
    { width: 18 }, // A First Name
    { width: 18 }, // B Last Name
    { width: 16 }, // C DOB
    { width: 16 }, // D Student ID
    { width: 20 }, // E Phone
    { width: 48 }, // F Qualification Code and Title
    { width: 48 }, // G Unit Code and Title
    { width: 14 }, // H Unit Start Date
    { width: 18 }, // I Unit Completion Date
    { width: 110 }, // J Delivery Site
    { width: 22 } // K Unit Progress Status
  ];

  const { start: rangeStart, end: rangeEnd } = getEnrollmentDateRange(params.startDate, params.endDate);
  const todayStr = formatDate(new Date());

  // ── Row 1: Title with RTO name in red, rest in black ─────────────────────
  // ExcelJS supports rich text for mixed colors in a single cell
  ws.mergeCells("A1:K1");
  ws.getCell("A1").value = {
    richText: [
      { text: "ASQA Enrolment and Completion Data for ", font: { bold: true, size: 11, color: { argb: COLOR_BLACK } } },
      { text: params.rtoName, font: { bold: true, size: 11, color: { argb: COLOR_RED } } },
      {
        text: " - Units completed in previous 6 months - as of ",
        font: { bold: true, size: 11, color: { argb: COLOR_BLACK } }
      },
      { text: todayStr, font: { bold: true, size: 11, color: { argb: COLOR_RED } } }
    ]
  };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ORANGE_HEADER } };
  ws.getRow(1).height = 24;
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

  // ── Row 2: Column headers ─────────────────────────────────────────────────
  const headers = ws.addRow([
    "First Name of Student",
    "Last Name of Student",
    "Student Date of Birth",
    "Student ID Number",
    "Student Phone Number",
    "Qualification Code and Title",
    "Unit Code and Title",
    "Unit Start Date",
    "Unit Completion Date (if applicable)",
    "Delivery Site (if applicable)",
    "Unit Progress Status/or Result"
  ]);
  headers.font = { bold: true, size: 10, color: { argb: COLOR_BLACK } };
  headers.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_BLUE_SUBHEADER } };
  headers.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
  headers.height = 55;
  for (let col = 1; col <= 11; col++) {
    headers.getCell(col).border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  }

  // ── Data rows ─────────────────────────────────────────────────────────────
  // Only include units that are completed (statusOfCompletion in COMPLETED_STATUSES)
  // AND whose unitCompletionDate falls within the 6-month range.

  const COMPLETED_STATUSES = new Set(ENROLLED_UNIT_COMPLETED_STATUSES);

  for (const cls of classes) {
    // E-05: skip classes opted out of ASQA reporting
    if ((cls as any).reportingDetails?.doNotReportAsqa) continue;

    const qual = cls.qualificationId as any;
    const qualCodeTitle = qual ? `${qual.code} - ${qual.title}` : "";

    const locationList = resolveLocations(cls);
    const deliverySite = locationList.join("\n");

    for (const enrollment of cls.enrollments || []) {
      const studentId = enrollment.studentInfo?.id || "";
      const sData = studentDataMap.get(studentId);

      const fullName: string = enrollment.studentInfo?.name || "";
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const dob = sData?.dob ? formatDate(sData.dob) : "";
      const studentIdNum = sData?.studentId || "";
      const phone = enrollment.studentInfo?.phone?.number || sData?.phone || "";

      for (const unit of enrollment.unitsOfCompetency || []) {
        // Must be a completed status
        if (!COMPLETED_STATUSES.has(unit.statusOfCompletion)) continue;

        // Must have a unitCompletionDate within the 6-month range
        if (!unit.unitCompletionDate) continue;
        const completionDate = new Date(unit.unitCompletionDate);
        if (completionDate < rangeStart || completionDate > rangeEnd) continue;

        const unitStartDate = unit.unitStartDate || unit.classStartDate || null;

        const row = ws.addRow([
          firstName,
          lastName,
          dob,
          studentIdNum,
          phone,
          qualCodeTitle,
          `${unit.code} - ${unit.title}`,
          formatDate(unitStartDate),
          formatDate(unit.unitCompletionDate),
          deliverySite,
          unit.statusOfCompletion
        ]);
        row.alignment = { wrapText: true, vertical: "top" };
        row.height = 18;
        row.height = deliverySite.split("\n").length > 1 ? deliverySite.split("\n").length * 30 : 20; // ← dynamic height
        for (let col = 1; col <= 11; col++) {
          row.getCell(col).border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
          };
        }
      }
    }
  }
};

// ─── Main Entry Point ─────────────────────────────────────────────────────────

const generateASQAReport = async (params: ASQAReportParams): Promise<{ buffer: Buffer; fileName: string }> => {
  const organization = await OrganizationModel.findById(params.organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found!");
  }

  const rtoName: string = organization.name || "";
  const rtoId: string = organization.rtoId || "";

  const reportId = await generateSequentialId({
    key: `asqa-report:${params.organizationId}`,
    prefix: "REP",
    middleIndicator: "ASQA-",
    pad: 7
  });

  const from = params.startDate.toISOString().slice(0, 10);
  const to = params.endDate.toISOString().slice(0, 10);

  // e.g. asqa_2025-01-01_to_2025-06-30_REP-ASQA-0000001.xlsx
  const fileName = `asqa_${from}_to_${to}_${reportId}.xlsx`;

  // DB title: asqa_2025-01-01_to_2025-06-30
  const title = `asqa_${from}_to_${to}`;

  const enrichedParams = { ...params, rtoName, rtoId };

  const wb = new ExcelJS.Workbook();
  wb.creator = params.generatedBy;
  wb.created = new Date();

  const classes = await fetchClassesInRange(params.organizationId, params.startDate, params.endDate);

  const studentIds = new Set<string>();
  for (const cls of classes as any[]) {
    for (const e of cls.enrollments || []) {
      if (e.studentInfo?.id) studentIds.add(e.studentInfo.id);
    }
  }

  const studentDocs = await StudentModel.find({ _id: { $in: Array.from(studentIds) } })
    .select("personalInfo.dateOfBirth studentId contactDetails.personalPhone")
    .lean();

  const studentDataMap = new Map<string, { dob: string; studentId: string; phone: string }>();
  for (const s of studentDocs as any[]) {
    studentDataMap.set(s._id.toString(), {
      dob: (s as any).personalInfo?.dateOfBirth || "",
      studentId: (s as any).studentId || "",
      phone: (s as any).contactDetails?.personalPhone?.number || ""
    });
  }

  const shouldInclude = (target: string) => params.reportType === "ALL" || params.reportType === target;

  if (shouldInclude("DELIVERY_DATA")) buildDeliveryDataSheet(wb, enrichedParams, classes as any[]);
  if (shouldInclude("STUDENT_SURVEY")) buildStudentSurveySheet(wb, params, classes as any[]);
  if (shouldInclude("ENROLLMENT_COMPLETION"))
    await buildEnrollmentCompletionSheet(wb, enrichedParams, classes as any[], studentDataMap);

  const buffer = await wb.xlsx.writeBuffer();
  const excelBuffer = Buffer.from(buffer);

  const uploadResult = await CloudflareService.uploadBufferToR2(excelBuffer, fileName, "asqa-reports", true, true);
  if (!uploadResult.success) {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Failed to upload ASQA report to storage");
  }

  // R-02: save light snapshot — class IDs + student count used in report generation
  const snapshotData = {
    classIds: (classes as any[]).map((c) => c._id?.toString()),
    classCount: (classes as any[]).length,
    studentCount: studentIds.size,
    generatedAt: new Date().toISOString()
  };

  await ASQAReportModel.create({
    title,
    organizationId: params.organizationId,
    reportId,
    reportType: params.reportType,
    startDate: params.startDate,
    endDate: params.endDate,
    generatedBy: params.generatedBy,
    reportKey: uploadResult.key!,
    snapshotData
  });

  return { buffer: excelBuffer, fileName };
};

const getAllReports = async (organizationId: string, query: Record<string, string>) => {
  const queryBuilder = new QueryBuilder(ASQAReportModel.find({ organizationId }), query);

  const searchableFields = ["reportId", "reportType", "generatedBy", "startDate", "endDate"];

  const reports = await queryBuilder.search(searchableFields).filter().sort().select().pagination().build();

  const meta = await queryBuilder.getMeta();
  return {
    reports,
    ...meta
  };
};

const downloadReport = async (id: string) => {
  const report = await ASQAReportModel.findById(id);
  if (!report) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Report not found");
  }
  return report.reportKey;
};

const bulkDownloadReports = async (organizationId: string, startDate: string, endDate: string, res: Response) => {
  const reports = await ASQAReportModel.find({
    organizationId,
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  });

  if (!reports.length) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "No reports found in this date range");
  }

  // bulk download: asqa_startDate_to_endDate.zip (downloading date range, not report generation date)
  const from = new Date(startDate).toISOString().slice(0, 10);
  const to = new Date(endDate).toISOString().slice(0, 10);
  const zipFileName = `asqa_${from}_to_${to}.zip`;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipFileName}"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(res);

  for (const report of reports) {
    const fileUrl = `${process.env.R2_PUBLIC_BASE_URL}/${report.reportKey}`;
    const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data);
    const stream = Readable.from(buffer);
    const originalFileName = report.reportKey.split("/").pop() || `${report.reportId}.xlsx`;
    archive.append(stream, { name: originalFileName });
  }

  await archive.finalize();
};

// ── 1. New interface (add near the top with other types/imports) ──────────────
export interface ASQAImportItem {
  buffer: Buffer;
  originalName: string;
  startDate: Date;
  endDate: Date;
  reportType: string; // "ALL" | "DELIVERY_DATA" | "STUDENT_SURVEY" | "ENROLLMENT_COMPLETION"
}

// ── 2. New service function (add before the AsqaService export) ───────────────
const importASQAReports = async (
  organizationId: string,
  generatedBy: string,
  items: ASQAImportItem[]
): Promise<{ imported: number; results: { fileName: string; reportId: string }[] }> => {
  if (!items || items.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "At least one file is required");
  }
  if (items.length > 5) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Maximum 5 files allowed per import");
  }

  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found!");
  }

  const results: { fileName: string; reportId: string }[] = [];

  for (const item of items) {
    if (!item.originalName.toLowerCase().endsWith(".xlsx")) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "BAD_REQUEST",
        `File "${item.originalName}" is not a valid .xlsx file`
      );
    }

    const reportId = await generateSequentialId({
      key: `asqa-report:${organizationId}`,
      prefix: "REP",
      middleIndicator: "ASQA-",
      pad: 7
    });

    const from = item.startDate.toISOString().slice(0, 10);
    const to = item.endDate.toISOString().slice(0, 10);

    const safeOriginalName = item.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${reportId}_${safeOriginalName}`;
    const title = `asqa_${from}_to_${to}`;

    const uploadResult = await CloudflareService.uploadBufferToR2(
      item.buffer,
      fileName,
      "asqa-reports",
      true, // requireDownloadableUrl
      true // useOriginalName
    );

    if (!uploadResult.success) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "UPLOAD_FAILED",
        `Failed to upload file "${item.originalName}" to storage`
      );
    }

    await ASQAReportModel.create({
      title,
      organizationId,
      reportId,
      reportType: item.reportType,
      startDate: item.startDate,
      endDate: item.endDate,
      generatedBy,
      reportKey: uploadResult.key!,
      isImported: true
    });

    results.push({ fileName: item.originalName, reportId });
  }

  return { imported: results.length, results };
};

const deleteReport = async (id: string) => {
  const report = await ASQAReportModel.findById(id);
  if (!report) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Report not found");
  }

  // Delete from R2
  await CloudflareService.deleteFileFromR2(report.reportKey);

  // Delete from DB
  await ASQAReportModel.findByIdAndDelete(id);
};

export const AsqaService = {
  generateASQAReport,
  getAllReports,
  downloadReport,
  bulkDownloadReports,
  importASQAReports,
  deleteReport
};

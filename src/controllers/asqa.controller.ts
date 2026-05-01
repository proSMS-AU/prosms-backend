// import { Response, Request } from "express";
// import { SUCCESS_MESSAGE } from "../constants";
// import { SendSuccessResponse, SendErrorResponse } from "../utils";
// import { ASQAService } from "../services/asqa.service";
// import { asyncWrapper } from "../utils";

// const generateReport = asyncWrapper(async (req: Request, res: Response) => {
//   // const user = req.user;
//   // const organizationId = user?.organizationId || user?._id;
//   const organizationId = "6975d0d222f05852e2d4881e";

//   if (!organizationId) {
//     return SendErrorResponse.badRequest({
//       res,
//       message: "Organization ID is required",
//       data: {
//         clientError: { code: "BAD_REQUEST", message: "Organization ID is required" }
//       }
//     });
//   }

//   const { reportType, startDate, endDate, completedBy } = req.body;

//   const result = await ASQAService.generateASQAReport(organizationId, reportType, startDate, endDate, completedBy);

//   return SendSuccessResponse.created({
//     res,
//     message: "ASQA Report generated successfully",
//     data: result
//   });
// });

// const getReportsList = asyncWrapper(async (req: Request, res: Response) => {
//   const user = req.user;
//   const organizationId = user?.organizationId || user?._id;

//   if (!organizationId) {
//     return SendErrorResponse.badRequest({
//       res,
//       message: "Organization ID is required",
//       data: {
//         clientError: { code: "BAD_REQUEST", message: "Organization ID is required" }
//       }
//     });
//   }

//   const page = Number(req.query.page) || 1;
//   const limit = Number(req.query.limit) || 10;
//   const startDate = req.query.startDate as string;
//   const endDate = req.query.endDate as string;

//   const result = await ASQAService.getASQAReports(organizationId, page, limit, startDate, endDate);

//   return SendSuccessResponse.success({
//     res,
//     message: SUCCESS_MESSAGE.RETRIEVED,
//     data: result
//   });
// });

// export const ASQAController = {
//   generateReport,
//   getReportsList
// };

import { Request, Response } from "express";
import { AsqaService } from "../services/asqa.service";
import { AppError } from "../utils/appError";
import { ASQA_REPORT_TYPES, httpStatus } from "../constants";
import { ASQAReportType } from "../types/asqa-report.type";
import { SendSuccessResponse } from "../utils";
import { streamFromR2 } from "../services/cloudflare.service";

const generateASQAReportHandler = async (req: Request, res: Response) => {
  const { startDate, endDate, reportType, generatedBy } = req.body;

  if (!startDate || !endDate || !reportType || !generatedBy) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "BAD_REQUEST",
      "startDate, endDate, reportType, and generatedBy are required"
    );
  }

  const validTypes = ASQA_REPORT_TYPES;
  if (!validTypes.includes(reportType)) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", `reportType must be one of: ${validTypes.join(", ")}`);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Invalid date format");
  }

  if (start > end) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "startDate must be before endDate");
  }

  const { fileName } = await AsqaService.generateASQAReport({
    organizationId: req.user?.organizationId as string,
    startDate: start,
    endDate: end,
    reportType: reportType as ASQAReportType,
    generatedBy
  });

  // JSON only — no buffer, no streaming
  SendSuccessResponse.success({
    res,
    message: "Report generated successfully!",
    data: { fileName }
  });
};

const getAllReportsHandler = async (req: Request, res: Response) => {
  const { reports, total, page, limit, totalPages } = await AsqaService.getAllReports(
    req.user?.organizationId as string,
    req.query as Record<string, string>
  );

  SendSuccessResponse.success({
    res,
    message: "All ASQA reports retrieved successfully!",
    meta: {
      total,
      page,
      limit,
      totalPages
    },
    data: reports
  });
};

const downloadReportHandler = async (req: Request, res: Response) => {
  const download = req.query.download === "true";
  const reportKey = await AsqaService.downloadReport(req.params.id);
  await streamFromR2(reportKey, res, download);
};

const bulkDownloadReportsHandler = async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "startDate and endDate are required");
  }

  await AsqaService.bulkDownloadReports(
    req.user?.organizationId as string,
    startDate as string,
    endDate as string,
    res
  );
};

const VALID_ASQA_REPORT_TYPES = ["ALL", "DELIVERY_DATA", "STUDENT_SURVEY", "ENROLLMENT_COMPLETION"];
const importASQAHandler = async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "No files uploaded");
  }
  if (files.length > 5) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Maximum 5 files allowed");
  }

  const { generatedBy } = req.body;
  if (!generatedBy) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "generatedBy is required");
  }

  let startDates: string[] = [];
  let endDates: string[] = [];
  let reportTypes: string[] = [];

  try {
    startDates = JSON.parse(req.body.startDates);
    endDates = JSON.parse(req.body.endDates);
    reportTypes = JSON.parse(req.body.reportTypes);
  } catch {
    startDates = [].concat(req.body.startDates);
    endDates = [].concat(req.body.endDates);
    reportTypes = [].concat(req.body.reportTypes);
  }

  if (startDates.length !== files.length || endDates.length !== files.length || reportTypes.length !== files.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "BAD_REQUEST",
      "Each file must have a corresponding startDate, endDate, and reportType"
    );
  }

  const items = files.map((file, idx) => {
    const start = new Date(startDates[idx]);
    const end = new Date(endDates[idx]);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", `Invalid date for file "${file.originalname}"`);
    }
    if (start > end) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "BAD_REQUEST",
        `startDate must be before endDate for file "${file.originalname}"`
      );
    }

    const rType = reportTypes[idx];
    if (!VALID_ASQA_REPORT_TYPES.includes(rType)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "BAD_REQUEST",
        `Invalid reportType "${rType}" for "${file.originalname}". Must be one of: ${VALID_ASQA_REPORT_TYPES.join(", ")}`
      );
    }

    return { buffer: file.buffer, originalName: file.originalname, startDate: start, endDate: end, reportType: rType };
  });

  const result = await AsqaService.importASQAReports(req.user?.organizationId as string, generatedBy, items);

  SendSuccessResponse.created({
    res,
    message: `Successfully imported ${result.imported} ASQA report(s)`,
    data: result
  });
};

const deleteReportHandler = async (req: Request, res: Response) => {
  await AsqaService.deleteReport(req.params.id);
  SendSuccessResponse.deleted({ res, message: "Report Deleted Successfully!", data: null });
};

export const AsqaController = {
  generateASQAReportHandler,
  getAllReportsHandler,
  downloadReportHandler,
  bulkDownloadReportsHandler,
  importASQAHandler,
  deleteReportHandler
};

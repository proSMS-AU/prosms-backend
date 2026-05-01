import { Request, Response } from "express";
import { AvetmissServices } from "../services/avetmiss.service";
import { SendSuccessResponse } from "../utils";
import { streamFromR2 } from "../services/cloudflare.service";
import { AppError } from "../utils/appError";
import { httpStatus } from "../constants";

const generateAvetmissReportHandler = async (req: Request, res: Response) => {
  const result = await AvetmissServices.generateAvetmissReport(
    req.user?.organizationId as string,
    req.user?._id as string,
    req.body
  );
  SendSuccessResponse.created({
    res,
    message: "Report generated successfully",
    data: result
  });
};
const getReportsHandler = async (req: Request, res: Response) => {
  const { reports, total, page, limit, totalPages } = await AvetmissServices.getAllReports(
    req.query as Record<string, string>,
    req.user?.organizationId as string
  );
  SendSuccessResponse.success({
    res,
    message: "Reports fetched successfully",
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
  const reportKey = await AvetmissServices.downloadReport(req.params.id);
  await streamFromR2(reportKey, res, download);
};

const bulkDownloadReportsHandler = async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "startDate and endDate are required");
  }

  await AvetmissServices.bulkDownloadReports(
    req.user?.organizationId as string,
    startDate as string,
    endDate as string,
    res
  );
};

const importAvetmissHandler = async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "No files uploaded");
  }
  if (files.length > 5) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Maximum 5 files allowed");
  }

  const generatedBy: string = req.body.generatedBy ?? (req.user?._id as string);

  let startDates: string[] = [];
  let endDates: string[] = [];

  try {
    startDates = JSON.parse(req.body.startDates);
    endDates = JSON.parse(req.body.endDates);
  } catch {
    startDates = [].concat(req.body.startDates);
    endDates = [].concat(req.body.endDates);
  }

  if (startDates.length !== files.length || endDates.length !== files.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "BAD_REQUEST",
      "Each file must have a corresponding startDate and endDate"
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
    return { buffer: file.buffer, originalName: file.originalname, startDate: start, endDate: end };
  });

  const result = await AvetmissServices.importAvetmissReports(req.user?.organizationId as string, generatedBy, items);

  SendSuccessResponse.created({
    res,
    message: `Successfully imported ${result.imported} AVETMISS report(s)`,
    data: result
  });
};

const deleteReportHandler = async (req: Request, res: Response) => {
  await AvetmissServices.deleteReport(req.params.id);
  SendSuccessResponse.deleted({ res, message: "Report Deleted Successfully!", data: null });
};

export const AvetmissController = {
  generateAvetmissReportHandler,
  getReportsHandler,
  downloadReportHandler,
  bulkDownloadReportsHandler,
  importAvetmissHandler,
  deleteReportHandler
};

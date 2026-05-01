import config from "config";
import { ILogSource, IErrorDetails } from "../interfaces";
import { LogLevel, LogModel } from "../model";
import { ErrorReportRole } from "../constants";

export async function captureErrorLog(data: {
  idForUser?: string;
  reportedBy?: string;
  message: string;
  source: ILogSource;
  errorDetails: IErrorDetails;
  metadata?: Record<string, unknown>;
  tags?: string[];
  screenshotUrls?: string[];
  additionalData?: Record<string, unknown>;
}) {
  const {
    reportedBy = ErrorReportRole.SYSTEM,
    idForUser,
    message,
    source,
    errorDetails,
    metadata,
    tags,
    screenshotUrls,
    additionalData
  } = data;
  const environment = config.get<string>("server.environment");
  const eLog = await LogModel.create({
    idForUser,
    reportedBy,
    level: LogLevel.ERROR,
    source: {
      ...source,
      application: "Exam Binary",
      environment
    },
    message,
    error: errorDetails,
    metadata,
    tags,
    screenshotUrls,
    additionalData
  });

  return eLog;
}

export async function captureInfoLog(data: {
  message: string;
  source?: ILogSource;
  metadata?: Record<string, unknown>;
  tags?: string[];
}) {
  const { message, source, metadata, tags } = data;
  const environment = config.get<string>("server.environment");
  const infoLog = await LogModel.create({
    level: LogLevel.INFO,
    source: {
      ...source,
      application: "Exam Binary",
      environment
    },
    message,
    metadata,
    tags
  });

  return infoLog;
}

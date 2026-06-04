/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import { AxiosError } from "axios";
import { logger } from "../utils";
import { UNEXPECTED_ERROR, httpStatus } from "../constants";

const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  (error as any).statusCode = httpStatus.NOT_FOUND;
  next(error);
};

// Turn a schema path like "personalInfo.givenName" into a human label "Given Name"
const humanizeFieldPath = (path: string): string => {
  const last = (path || "").split(".").pop() || path || "field";
  return last
    .replace(/([A-Z])/g, " $1") // camelCase → spaced
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
};

// Convert a raw Mongoose validation/cast error into a single user-friendly sentence
const friendlyMongooseMessage = (error: any): string => {
  const first: any = Object.values(error?.errors ?? {})[0];
  if (!first) return "Some of the information provided is invalid. Please review and try again.";

  const label = humanizeFieldPath(first.path ?? "");
  if (first.kind === "required" || /is required/i.test(first.message ?? "")) {
    return `${label} is required.`;
  }
  if (first.name === "CastError" || first.kind) {
    return `${label} has an invalid value. Please check it and try again.`;
  }
  return `${label} is invalid. Please check it and try again.`;
};

const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  const clientError = UNEXPECTED_ERROR;
  logger.error(
    `An unexpected error (path: ${req.path} | method: ${req.method}): `.concat(error?.message ?? String(error))
  );

  // Mongoose schema validation / cast errors — translate the developer message to a user-friendly one
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    const friendly = friendlyMongooseMessage(error);
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: friendly,
      data: { clientError: { code: "wrong_input_data", message: friendly } },
      stack: process.env.NODE_ENV === "production" ? "🥞" : error.stack
    });
  }

  // MongoDB duplicate key error
  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];
    const value = error.keyValue?.[field];

    logger.warn(`Duplicate key error: ${field} -> ${value}`);

    return res.status(httpStatus.CONFLICT).json({
      success: false,
      message: `${field} '${value}' already exists`,
      data: {
        clientError,
        code: "DUPLICATE_KEY",
        field,
        value
      },
      stack: process.env.NODE_ENV === "production" ? "🥞" : error.stack
    });
  }

  // Axios errors (external HTTP calls)
  if (error instanceof AxiosError) {
    const statusCode = error.response?.data?.message?.toLowerCase().includes("not found")
      ? httpStatus.NOT_FOUND
      : error.response?.status || httpStatus.INTERNAL_SERVER_ERROR;

    return res.status(statusCode).json({
      success: false,
      message: error.response?.data?.message || error.message,
      data: { clientError },
      stack: process.env.NODE_ENV === "production" ? "🥞" : error.stack
    });
  }

  // Custom app error (StudentError or other AppError types with statusCode)
  if (error && typeof error.statusCode === "number") {
    return res.status(error.statusCode).json({
      success: false,
      // message: `${error.name}: ${error.message}`,
      message: error.message,
      data: { clientError, code: error.code ?? null },
      stack: process.env.NODE_ENV === "production" ? "🥞" : error.stack
    });
  }

  // Fallback — unknown error
  const fallbackStatus = httpStatus.INTERNAL_SERVER_ERROR;
  return res.status(fallbackStatus).json({
    success: false,
    // message: error?.name ? `${error.name}: ${error.message}` : String(error),
    message: error?.message ? `${error.message}` : String(error),
    data: { clientError },
    stack: process.env.NODE_ENV === "production" ? "🥞" : error?.stack
  });
};

export { notFoundHandler, errorHandler };

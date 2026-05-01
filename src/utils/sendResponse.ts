import { Response } from "express";
import { httpStatus } from "../constants";

interface SendSuccessResponseProps<T> {
  res: Response;
  data: T;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export class SendSuccessResponse {
  private static sendSuccessResponse<T>(
    res: Response,
    statusCode: number,
    { data, message, meta }: SendSuccessResponseProps<T>
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      meta,
      data
    });
  }

  static success<T>(props: SendSuccessResponseProps<T>) {
    return this.sendSuccessResponse(props.res, httpStatus.OK, props);
  }

  static created<T>(props: SendSuccessResponseProps<T>) {
    return this.sendSuccessResponse(props.res, httpStatus.CREATED, props);
  }

  static updated<T>(props: SendSuccessResponseProps<T>) {
    return this.sendSuccessResponse(props.res, httpStatus.OK, props);
  }

  static deleted<T>(props: SendSuccessResponseProps<T>) {
    return this.sendSuccessResponse(props.res, httpStatus.OK, props);
  }
}

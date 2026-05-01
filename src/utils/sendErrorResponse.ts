import { Response } from "express";
import { httpStatus } from "../constants";

interface IErrorData {
  clientError: {
    code: string;
    message: string;
  };
  endpoint?: string;
  service?: string;
  functionName?: string;
  method?: string;
  id?: string;
}

interface ErrorResponseProps<T> {
  res: Response;
  data: T;
  message: string;
}

export class SendErrorResponse {
  private static sendErrorResponse<T>(res: Response, statusCode: number, { data, message }: ErrorResponseProps<T>) {
    return res.status(statusCode).json({
      success: false,
      message,
      data
    });
  }

  static badRequest(props: ErrorResponseProps<IErrorData>) {
    return this.sendErrorResponse(props.res, httpStatus.BAD_REQUEST, props);
  }

  static notFound(props: ErrorResponseProps<IErrorData>) {
    return this.sendErrorResponse(props.res, httpStatus.NOT_FOUND, props);
  }

  static conflict(props: ErrorResponseProps<IErrorData>) {
    return this.sendErrorResponse(props.res, httpStatus.CONFLICT, props);
  }

  static unauthorized(props: ErrorResponseProps<IErrorData>) {
    return this.sendErrorResponse(props.res, httpStatus.UNAUTHORIZED, props);
  }

  static internalServer(props: ErrorResponseProps<IErrorData>) {
    return this.sendErrorResponse(props.res, httpStatus.INTERNAL_SERVER_ERROR, props);
  }

  static forbidden(props: ErrorResponseProps<IErrorData>) {
    return this.sendErrorResponse(props.res, httpStatus.FORBIDDEN, props);
  }
}

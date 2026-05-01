import { Request, Response } from "express";
import { DemoEchoType } from "../schemas";
import { SendErrorResponse, SendSuccessResponse } from "../utils";
import { FORBIDDEN_ERROR, SystemServices } from "../constants";

export function demoEchoHandler(req: Request<unknown, unknown, DemoEchoType>, res: Response) {
  const functionName = demoEchoHandler.name;

  const data = req.body;

  if (data.property2) {
    return SendErrorResponse.forbidden({
      res,
      message: "To get success response you need to remove the property2 from request payload or set it as null!",
      data: {
        clientError: {
          ...FORBIDDEN_ERROR,
          message: "You're in trap! Contact unseen person if need any help." // overwriting the existing message if needed
        },
        endpoint: req.originalUrl,
        functionName,
        method: req.method,
        service: SystemServices.DEMO
      }
    });
  }

  return SendSuccessResponse.success({
    res,
    message: "Awesome!! You are getting a success response!",
    data: null
  });
}

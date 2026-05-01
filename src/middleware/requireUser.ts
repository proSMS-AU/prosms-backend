import { NextFunction, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { SendErrorResponse } from "../utils";
import { SystemServices, DATA_NOT_FOUND, UNAUTHORIZED_ERROR } from "../constants";

const requireUser = (req: Request, res: Response, next: NextFunction) => {
  const functionName = requireUser.name;
  const { user } = res.locals;

  if (!user) {
    SendErrorResponse.unauthorized({
      res,
      message: "Unauthorized request! User information is not found in Database.",
      data: {
        clientError: {
          ...UNAUTHORIZED_ERROR,
          message:
            "Unauthorized request! Account information not found. Please contact support team for further assistance."
        },
        endpoint: req.originalUrl,
        method: req.method,
        service: SystemServices.MIDDLEWARE,
        functionName,
        id: uuid()
      }
    });
    return;
  }

  if (user.isDeleted) {
    SendErrorResponse.notFound({
      res,
      message: "User's account is deleted.",
      data: {
        clientError: {
          ...DATA_NOT_FOUND,
          message: "Account information not found. Please contact support team for further assistance."
        },
        endpoint: req.originalUrl,
        method: req.method,
        service: SystemServices.MIDDLEWARE,
        functionName,
        id: uuid()
      }
    });
    return;
  }

  return next();
};

export default requireUser;

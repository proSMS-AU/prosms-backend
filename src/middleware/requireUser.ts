import { NextFunction, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { SendErrorResponse } from "../utils";
import { SystemServices, DATA_NOT_FOUND, UNAUTHORIZED_ERROR } from "../constants";
import { OrganizationModel } from "../model/organization.model";

const requireUser = async (req: Request, res: Response, next: NextFunction) => {
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

  // Allow the one endpoint that the disabled screen needs — it explicitly works
  // for deleted-org sessions to show basic org info.
  const isDisabledInfoRoute =
    req.method === "GET" && req.path === "/disabled-info";

  if (user.organizationId && !isDisabledInfoRoute) {
    const org = await OrganizationModel.findById(user.organizationId).select("isDeleted").lean();
    if (org?.isDeleted) {
      res.status(403).json({
        success: false,
        errorCode: "ORG_DISABLED",
        message: "Your organisation account has been disabled. Please contact the authority."
      });
      return;
    }
  }

  return next();
};

export default requireUser;

import { NextFunction, Response, Request } from "express";
import jwt from "jsonwebtoken";
import { logger, SendErrorResponse } from "../utils";
import config from "config";
import { verifyToken } from "../utils/jwtHelper";
import { AuthModel } from "../model/auth.model";

/**
 * @deprecated Use `sessionValidator` from `src/middleware/session-validator.ts` instead.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accessToken = req.cookies.accessToken;

    if (!accessToken) {
      return SendErrorResponse.unauthorized({
        message: "Authentication required",
        data: {
          clientError: {
            code: "AUTHENTICATION_REQUIRED",
            message: "Please log in to access this resource"
          }
        },
        res
      });
    }

    // Verify the access token
    const decoded = verifyToken(accessToken, config.get("server.accessTokenSecret") as string) as {
      userId: string;
      name: string;
      email: string;
    };

    // Find the user in the database
    const user = await AuthModel.findById(decoded.userId);

    if (!user) {
      return SendErrorResponse.unauthorized({
        message: "User not found",
        data: {
          clientError: {
            code: "USER_NOT_FOUND",
            message: "User associated with this token does not exist"
          }
        },
        res
      });
    }

    // Populate req.user
    req.user = {
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
      password: "",
      organizationId: user.organizationId
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return SendErrorResponse.unauthorized({
        message: "Access token expired",
        data: {
          clientError: {
            code: "ACCESS_TOKEN_EXPIRED",
            message: "Access token has expired. Please refresh your token."
          }
        },
        res
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      return SendErrorResponse.unauthorized({
        message: "Invalid access token",
        data: {
          clientError: {
            code: "INVALID_ACCESS_TOKEN",
            message: "Access token is invalid"
          }
        },
        res
      });
    } else {
      logger.error("Authentication error:", error);
      return SendErrorResponse.unauthorized({
        message: "Authentication failed",
        data: {
          clientError: {
            code: "AUTHENTICATION_FAILED",
            message: "Could not authenticate user"
          }
        },
        res
      });
    }
  }
};

export const requireGuest = (req: Request, res: Response, next: NextFunction) => {
  const accessToken = req.cookies.accessToken;

  if (accessToken) {
    return SendErrorResponse.badRequest({
      message: "Already authenticated",
      data: {
        clientError: {
          code: "ALREADY_AUTHENTICATED",
          message: "You are already logged in"
        }
      },
      res
    });
  }

  next();
};

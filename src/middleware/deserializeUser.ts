// backend/middleware/deserializeUser.ts

import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import config from "config";
import { verifyToken } from "../utils/jwtHelper";
import { AuthModel } from "../model/auth.model";
import { logger } from "../utils";

const deserializeUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accessToken = req.cookies.accessToken;

    // If no access token, just continue without setting req.user
    if (!accessToken) {
      return next();
    }

    // Try to verify the token
    const decoded = verifyToken(accessToken, config.get("server.accessTokenSecret") as string) as {
      userId: string;
      name: string;
      email: string;
    };

    // Find the user in the database
    const user = await AuthModel.findById(decoded.userId);

    // If user found, attach to request
    if (user) {
      req.user = {
        _id: user._id.toString(),
        email: user.email,
        name: user.name,
        password: "",
        organizationId: user.organizationId
      };
    }
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.info("ℹ️ [Deserialize] Access token expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.info("ℹ️ [Deserialize] Invalid access token");
    } else {
      logger.info("ℹ️ [Deserialize] Token verification failed:", error);
    }

    next();
  }
};
export default deserializeUser;

import { NextFunction, Request, Response } from "express";
import { AuthServices } from "../services/auth.service";
import { SendSuccessResponse, SendErrorResponse, logger } from "../utils";
import { setAuthCookie, clearAuthCookies } from "../utils/cookieSetter";
import { AppError } from "../utils/appError";

// Login handler
const loginHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const loginResult = await AuthServices.login(email, password);

    // Set auth cookies
    setAuthCookie(res, {
      accessToken: loginResult.accessToken,
      refreshToken: loginResult.refreshToken
    });

    SendSuccessResponse.success({
      res,
      message: "Login successful",
      data: {
        user: loginResult.user
      }
    });
  } catch (error) {
    logger.error("Login error:", error);
    next(error);
  }
};

// Refresh token handler
const refreshTokenHandler = async (req: Request, res: Response) => {
  try {
    logger.info("[Backend] Cookies received:", {
      hasAccessToken: !!req.cookies.accessToken,
      hasRefreshToken: !!req.cookies.refreshToken,
      allCookies: Object.keys(req.cookies)
    });

    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      logger.error("[Backend] No refresh token in cookies");

      // Clear any remaining cookies
      clearAuthCookies(res);

      return SendErrorResponse.unauthorized({
        message: "No refresh token found",
        data: {
          clientError: {
            code: "NO_REFRESH_TOKEN",
            message: "Please login again"
          }
        },
        res
      });
    }

    logger.info("[Backend] Attempting to refresh tokens...");
    const refreshResult = await AuthServices.refreshTokens(refreshToken);
    logger.info("[Backend] Tokens refreshed successfully");

    // Update cookies with new tokens
    setAuthCookie(res, {
      accessToken: refreshResult.accessToken,
      refreshToken: refreshResult.refreshToken
    });

    logger.info("[Backend] New cookies set");

    SendSuccessResponse.success({
      res,
      message: "Tokens refreshed successfully",
      data: {
        user: refreshResult.user
      }
    });
  } catch (error) {
    logger.error("[Backend] Token refresh error:", error);

    // CRITICAL: Clear cookies on any refresh token error
    clearAuthCookies(res);
    logger.info("[Backend] Cookies cleared due to error");

    if (error instanceof AppError) {
      return SendErrorResponse.unauthorized({
        message: error.message,
        data: {
          clientError: {
            code: error.code,
            message: error.message
          }
        },
        res
      });
    } else {
      return SendErrorResponse.unauthorized({
        message: "Token refresh failed",
        data: {
          clientError: {
            code: "TOKEN_REFRESH_FAILED",
            message: "Please login again"
          }
        },
        res
      });
    }
  }
};

// Logout handler
const logoutHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    clearAuthCookies(res);
    logger.info("🗑️ [Backend] Cookies cleared");

    SendSuccessResponse.success({
      res,
      message: "Logout successful",
      data: null
    });
  } catch (error) {
    logger.error("Logout error:", error);
    next(error);
  }
};

const changePasswordHandler = async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user?._id;
  const changePasswordResult = await AuthServices.changePassword(userId as string, oldPassword, newPassword);
  SendSuccessResponse.success({
    res,
    message: "Password changed successfully",
    data: changePasswordResult
  });
};

export const AuthController = {
  loginHandler,
  refreshTokenHandler,
  logoutHandler,
  changePasswordHandler
};

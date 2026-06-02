import { NextFunction, Request, Response } from "express";
import { AuthServices } from "../services/auth.service";
import { SendSuccessResponse, SendErrorResponse, logger } from "../utils";
import { setAuthCookie, clearAuthCookies } from "../utils/cookieSetter";
import { AppError } from "../utils/appError";
import { TotpService } from "../services/totp.service";
import { EmailOtpService } from "../services/emailOtp.service";
import { AuthModel } from "../model/auth.model";
import { pendingOtpCaptures } from "../utils/auth";
import { jwtProvider } from "../utils/jwtProvider";
import jwt from "jsonwebtoken";
import config from "config";

// Login handler
const loginHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const loginResult = await AuthServices.login(email, password);

    if (loginResult.status === "2fa_required") {
      return SendSuccessResponse.success({
        res,
        message: "2FA required",
        data: { status: "2fa_required", tempToken: loginResult.tempToken }
      });
    }

    // Set auth cookies
    setAuthCookie(res, {
      accessToken: (loginResult as { accessToken?: string }).accessToken!,
      refreshToken: (loginResult as { refreshToken?: string }).refreshToken!
    });

    SendSuccessResponse.success({
      res,
      message: "Login successful",
      data: {
        user: (loginResult as { user?: unknown }).user
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

const sendLoginEmailOtpHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tempToken } = req.body;
    if (!tempToken) {
      return SendErrorResponse.badRequest({
        res,
        message: "tempToken is required",
        data: { clientError: { code: "MISSING_TEMP_TOKEN", message: "tempToken is required" } }
      });
    }

    let payload: { userId: string; purpose: string };
    try {
      payload = jwt.verify(tempToken, config.get("server.accessTokenSecret") as string) as { userId: string; purpose: string };
    } catch {
      throw new AppError(400, "INVALID_TEMP_TOKEN", "Temp token is invalid or expired");
    }

    if (payload.purpose !== "2fa_gate") {
      throw new AppError(400, "INVALID_TEMP_TOKEN", "Invalid token purpose");
    }

    await EmailOtpService.sendOtp(payload.userId, "email-otp-verify");

    return SendSuccessResponse.success({ res, message: "OTP sent to your email", data: null });
  } catch (error) {
    next(error);
  }
};

const validateTwoFactorHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tempToken, code, method } = req.body as { tempToken: string; code: string; method?: "totp" | "email" };

    let payload: { userId: string; purpose: string };
    try {
      payload = jwt.verify(tempToken, config.get("server.accessTokenSecret") as string) as { userId: string; purpose: string };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError(401, "TEMP_TOKEN_EXPIRED", "Authenticator session expired.");
      }
      throw new AppError(400, "INVALID_TEMP_TOKEN", "Invalid verification session.");
    }

    if (payload.purpose !== "2fa_gate") {
      throw new AppError(400, "INVALID_TEMP_TOKEN", "Invalid token purpose");
    }

    const { userId } = payload;
    let valid = false;

    if (method === "email") {
      valid = await EmailOtpService.verifyOtp(userId, code, "email-otp-verify");
    } else {
      valid = await TotpService.verifyToken(userId, code);
    }

    if (!valid) {
      throw new AppError(401, "INVALID_2FA_CODE", "Invalid or expired 2FA code");
    }

    const user = await AuthModel.findById(userId);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");

    // Bridge to better-auth: intercept the OTP generated for this email
    // so the frontend can call authClient.signIn.emailOtp() to create a session
    const baseURL = config.get<string>("server.host");
    pendingOtpCaptures.set(user.email, "");

    try {
      await fetch(`${baseURL}/api/auth/email-otp/send-verification-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, type: "sign-in" })
      });
    } finally {
      // Ensure the map is cleaned up even on fetch error
    }

    const capturedOtp = pendingOtpCaptures.get(user.email) || "";
    pendingOtpCaptures.delete(user.email);

    SendSuccessResponse.success({
      res,
      message: "2FA verified",
      data: { email: user.email, otp: capturedOtp }
    });
  } catch (error) {
    next(error);
  }
};

export const AuthController = {
  loginHandler,
  refreshTokenHandler,
  logoutHandler,
  changePasswordHandler,
  sendLoginEmailOtpHandler,
  validateTwoFactorHandler
};

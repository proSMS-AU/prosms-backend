import { Router, Request, Response } from "express";
import { asyncWrapper, logger, SendErrorResponse, SendSuccessResponse } from "../utils";
import { loginSchema } from "../schemas";
import { validateResource } from "../middleware";
import { requireGuest, requireAuth } from "../middleware/jwtAuth.middleware";
import { sessionValidator } from "../middleware/session-validator";
import { AuthController } from "../controllers/auth.controller";
import { AuthModel } from "../model/auth.model";
import { getMongoDb } from "../utils/db-connection";
import { pendingOtpCaptures } from "../utils/auth";
import config from "config";
import jwt from "jsonwebtoken";
import { verifyPassword as betterAuthVerifyPassword } from "better-auth/crypto";

const router = Router();

router.post("/login", requireGuest, validateResource(loginSchema), asyncWrapper(AuthController.loginHandler));

router.post("/refresh-token", asyncWrapper(AuthController.refreshTokenHandler));

router.post("/change-password", sessionValidator(), asyncWrapper(AuthController.changePasswordHandler));

router.post("/logout", sessionValidator(), asyncWrapper(AuthController.logoutHandler));

// very important endpoint for password verification
router.post("/verify-password", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return SendErrorResponse.badRequest({
        res,
        message: "Email and password are required",
        data: { clientError: { code: "INVALID_CREDENTIALS", message: "Please provide both email and password" } }
      });
    }

    const db = getMongoDb();

    const user = await db!.collection("user").findOne({ email });
    if (!user) {
      return SendErrorResponse.notFound({
        res,
        message: "Invalid credentials",
        data: { clientError: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } }
      });
    }

    const account = await db!.collection("account").findOne({
      userId: user._id,
      providerId: "credential"
    });

    if (!account?.password) {
      return SendErrorResponse.badRequest({
        res,
        message: "Invalid credentials",
        data: { clientError: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } }
      });
    }

    // Verify password using better-auth's internal scrypt verifier
    const isValid = await betterAuthVerifyPassword({
      hash: account.password,
      password
    });

    if (!isValid) {
      return SendErrorResponse.badRequest({
        res,
        message: "Invalid credentials",
        data: { clientError: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } }
      });
    }

    const customUser = await AuthModel.findOne({ email }).lean();
    const twoFaEnabled = customUser?.twoFactorAuth?.twoFaEnabled === true;

    // 2FA is off — use the pendingOtpCaptures bridge (same pattern as TOTP flow) to
    // silently generate a session OTP and return it so the frontend can call
    // authClient.signIn.emailOtp() without any user interaction.
    if (!twoFaEnabled) {
      pendingOtpCaptures.set(email, "");
      try {
        await fetch(`${config.get<string>("server.host")}/api/auth/email-otp/send-verification-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, type: "sign-in" })
        });
      } finally { /* never block login on fetch failure */ }
      const capturedOtp = pendingOtpCaptures.get(email) ?? "";
      pendingOtpCaptures.delete(email);
      return res.status(200).json({ status: "no_2fa", email, otp: capturedOtp });
    }

    const hasTOTP = customUser?.twoFactorAuth?.enabled === true;

    const baseURL = config.get<string>("server.host");

    if (hasTOTP) {
      // Issue a short-lived tempToken so the TOTP endpoint can verify identity
      const tempToken = jwt.sign(
        { userId: customUser!._id.toString(), email, purpose: "2fa_gate" },
        config.get("server.accessTokenSecret") as string,
        { expiresIn: "15m" }
      );
      return res.status(200).json({ status: "totp_required", tempToken, email });
    }

    // 2FA is on and method is email OTP — send OTP via better-auth
    const otpRes = await fetch(`${baseURL}/api/auth/email-otp/send-verification-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, type: "sign-in" })
    });

    if (!otpRes.ok) {
      const err = await otpRes.json();
      throw new Error(err?.message || "Failed to send OTP");
    }

    return res.status(200).json({ status: "email_otp_sent", email });
  } catch (error) {
    logger.error("Error sending OTP:", error);
    return SendErrorResponse.internalServer({
      res,
      message: "Internal Server Error",
      data: { clientError: { code: "INTERNAL_SERVER_ERROR", message: "Internal Server Error" } }
    });
  }
});

// Session check — used by Next.js middleware to verify custom JWT sessions
router.get("/me", requireAuth, asyncWrapper(async (req: Request, res: Response) => {
  const user = await AuthModel.findById(req.user?._id).lean();
  if (!user) {
    return SendErrorResponse.notFound({ res, message: "User not found", data: { clientError: { code: "USER_NOT_FOUND", message: "User not found" } } });
  }
  return SendSuccessResponse.success({ res, message: "User fetched", data: { user } });
}));

// H.3: Send email OTP for login gate (no session — tempToken only)
router.post("/2fa/send-login-otp", asyncWrapper(AuthController.sendLoginEmailOtpHandler));

// H.3: 2FA validation after login
router.post("/2fa/validate", asyncWrapper(AuthController.validateTwoFactorHandler));

export default router;

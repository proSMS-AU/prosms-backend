import { Router, Request, Response } from "express";
import { asyncWrapper, logger, SendErrorResponse } from "../utils";
import { loginSchema } from "../schemas";
import { validateResource } from "../middleware";
import { requireGuest } from "../middleware/jwtAuth.middleware";
import { sessionValidator } from "../middleware/session-validator";
import { AuthController } from "../controllers/auth.controller";
import { getMongoDb } from "../utils/db-connection";
import config from "config";
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

    const baseURL = config.get<string>("server.host");

    const otpRes = await fetch(`${baseURL}/api/auth/email-otp/send-verification-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, type: "sign-in" })
    });

    if (!otpRes.ok) {
      const err = await otpRes.json();
      throw new Error(err?.message || "Failed to send OTP");
    }

    return res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    logger.error("Error sending OTP:", error);
    return SendErrorResponse.internalServer({
      res,
      message: "Internal Server Error",
      data: { clientError: { code: "INTERNAL_SERVER_ERROR", message: "Internal Server Error" } }
    });
  }
});

export default router;

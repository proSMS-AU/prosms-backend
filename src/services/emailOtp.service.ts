import argon2 from "argon2";
import crypto from "crypto";
import { OtpCodeModel } from "../model/otp-code.model";
import { AuthModel } from "../model/auth.model";
import { AppError } from "../utils/appError";
import { httpStatus } from "../constants";
import { emailService } from "../utils/sendEmail";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_OTP_PER_WINDOW = 3;

const generateOtp = (): string => {
  return String(crypto.randomInt(100000, 999999));
};

const sendOtp = async (userId: string, purpose: string) => {
  const user = await AuthModel.findById(userId);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found");

  // Rate limit: max 3 OTPs per 15 minutes
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recentCount = await OtpCodeModel.countDocuments({
    userId,
    purpose,
    createdAt: { $gte: windowStart }
  });

  if (recentCount >= MAX_OTP_PER_WINDOW) {
    throw new AppError(httpStatus.TOO_MANY_REQUESTS, "OTP_RATE_LIMITED", "Too many OTP requests. Please wait 15 minutes.");
  }

  const code = generateOtp();
  const hashedCode = await argon2.hash(code);

  await OtpCodeModel.create({ userId, hashedCode, purpose, used: false });

  await emailService.sendEmail({
    to: user.email,
    subject: "Your ProSMS verification code",
    templateName: "otp-verification",
    templateData: { otp: code, expiresInMinutes: 10 },
  });

  return { sent: true };
};

const verifyOtp = async (userId: string, code: string, purpose: string): Promise<boolean> => {
  const otpRecord = await OtpCodeModel.findOne({ userId, purpose, used: false }).sort({ createdAt: -1 });
  if (!otpRecord) return false;

  const valid = await argon2.verify(otpRecord.hashedCode, code);
  if (valid) {
    otpRecord.used = true;
    await otpRecord.save();
  }
  return valid;
};

const toggleEmailOtp = async (userId: string, enable: boolean) => {
  await AuthModel.findByIdAndUpdate(userId, { $set: { "twoFactorAuth.emailOtpEnabled": enable } });
  return { enabled: enable };
};

export const EmailOtpService = { sendOtp, verifyOtp, toggleEmailOtp };

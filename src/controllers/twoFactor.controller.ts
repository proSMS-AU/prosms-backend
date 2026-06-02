import { Request, Response } from "express";
import { SendSuccessResponse, SendErrorResponse } from "../utils";
import { TotpService } from "../services/totp.service";
import { EmailOtpService } from "../services/emailOtp.service";
import { AuthModel } from "../model/auth.model";

const setupHandler = async (req: Request, res: Response) => {
  const result = await TotpService.generateSetup(String(req.user!._id));
  SendSuccessResponse.success({ res, message: "TOTP setup initiated", data: result });
};

const verifySetupHandler = async (req: Request, res: Response) => {
  const { secret, token, label } = req.body as { secret: string; token: string; label?: string };
  const result = await TotpService.verifyAndAddDevice(
    String(req.user!._id),
    secret,
    token,
    label ?? "Authenticator App"
  );
  SendSuccessResponse.created({ res, message: "Authenticator device added", data: result });
};

const removeDeviceHandler = async (req: Request, res: Response) => {
  const deviceIndex = parseInt(req.params.index);
  const result = await TotpService.removeDevice(String(req.user!._id), deviceIndex);
  SendSuccessResponse.deleted({ res, message: "Device removed", data: result });
};

const getDevicesHandler = async (req: Request, res: Response) => {
  const result = await TotpService.getDevices(String(req.user!._id));
  SendSuccessResponse.success({ res, message: "2FA devices retrieved", data: result });
};

const sendEmailOtpHandler = async (req: Request, res: Response) => {
  const result = await EmailOtpService.sendOtp(String(req.user!._id), "email-otp-verify");
  SendSuccessResponse.success({ res, message: "OTP sent", data: result });
};

const verifyEmailOtpHandler = async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };
  const valid = await EmailOtpService.verifyOtp(String(req.user!._id), code, "email-otp-verify");
  if (!valid) {
    return SendSuccessResponse.success({ res, message: "Invalid or expired OTP", data: { valid: false } });
  }
  SendSuccessResponse.success({ res, message: "OTP verified", data: { valid: true } });
};

const toggleEmailOtpHandler = async (req: Request, res: Response) => {
  const { enable } = req.body as { enable: boolean };
  const result = await EmailOtpService.toggleEmailOtp(String(req.user!._id), enable);
  SendSuccessResponse.updated({ res, message: `Email OTP ${enable ? "enabled" : "disabled"}`, data: result });
};

const toggleGlobal2FAHandler = async (req: Request, res: Response) => {
  const { enable } = req.body as { enable: boolean };
  // Two-factor authentication is mandatory for super admins — it cannot be turned off.
  if (!enable && (req.user as { role?: string })?.role === "SUPER_ADMIN") {
    return SendErrorResponse.forbidden({
      res,
      message: "Two-factor authentication cannot be disabled for a super admin",
      data: {
        clientError: {
          code: "SA_2FA_REQUIRED",
          message: "Two-factor authentication is mandatory for super admin accounts."
        }
      }
    });
  }
  const update: Record<string, unknown> = { "twoFactorAuth.twoFaEnabled": enable };
  if (enable) update["twoFactorAuth.emailOtpEnabled"] = true;
  await AuthModel.findByIdAndUpdate(String(req.user!._id), { $set: update });
  SendSuccessResponse.updated({
    res,
    message: `Two-factor auth ${enable ? "enabled" : "disabled"}`,
    data: { enabled: enable }
  });
};

export const TwoFactorController = {
  setupHandler,
  verifySetupHandler,
  removeDeviceHandler,
  getDevicesHandler,
  sendEmailOtpHandler,
  verifyEmailOtpHandler,
  toggleEmailOtpHandler,
  toggleGlobal2FAHandler
};

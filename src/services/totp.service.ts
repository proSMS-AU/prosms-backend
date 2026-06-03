import QRCode from "qrcode";
import { AuthModel } from "../model/auth.model";
import { AppError } from "../utils/appError";
import { httpStatus } from "../constants";
import { encrypt, decrypt, generateTotpSecret, generateOtpAuthUrl, verifyTotpToken } from "../utils/cryptoHelper";
import { emailService } from "../utils/sendEmail";

const generateSetup = async (userId: string) => {
  const user = await AuthModel.findById(userId);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found");

  const secret = generateTotpSecret();
  const otpauthUrl = generateOtpAuthUrl(secret, user.email);
  const qrCode = await QRCode.toDataURL(otpauthUrl);

  return { secret, otpauthUrl, qrCode };
};

const verifyAndAddDevice = async (userId: string, secret: string, token: string, label: string) => {
  const user = await AuthModel.findById(userId);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found");

  const valid = verifyTotpToken(token, secret);
  if (!valid) throw new AppError(httpStatus.BAD_REQUEST, "INVALID_TOKEN", "Invalid TOTP token");

  const encryptedSecret = encrypt(secret);
  const devices = user.twoFactorAuth?.devices ?? [];
  devices.push({ encryptedSecret, label, addedAt: new Date() });

  await AuthModel.findByIdAndUpdate(userId, {
    $set: {
      "twoFactorAuth.enabled": true,
      "twoFactorAuth.devices": devices
    }
  });

  const addedAt = new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    dateStyle: "medium",
    timeStyle: "short"
  });
  emailService
    .sendEmail({
      to: user.email,
      subject: "New authenticator device added to your ProSMS account",
      templateName: "new-device-added",
      templateData: { name: user.name, deviceLabel: label, addedAt }
    })
    .catch(() => {});

  return { added: true, label };
};

const removeDevice = async (userId: string, deviceIndex: number) => {
  const user = await AuthModel.findById(userId);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found");

  const devices = user.twoFactorAuth?.devices ?? [];
  if (deviceIndex < 0 || deviceIndex >= devices.length) {
    throw new AppError(httpStatus.BAD_REQUEST, "INVALID_DEVICE_INDEX", "Device not found");
  }

  devices.splice(deviceIndex, 1);
  const enabled = devices.length > 0;

  await AuthModel.findByIdAndUpdate(userId, {
    $set: {
      "twoFactorAuth.devices": devices,
      "twoFactorAuth.enabled": enabled
    }
  });

  return { removed: true, remainingDevices: devices.length };
};

const getDevices = async (userId: string) => {
  const user = await AuthModel.findById(userId);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found");

  const devices = (user.twoFactorAuth?.devices ?? []).map((d, index) => ({
    index,
    label: d.label,
    addedAt: d.addedAt
  }));

  return {
    enabled: user.twoFactorAuth?.enabled ?? false,
    twoFaEnabled: user.twoFactorAuth?.twoFaEnabled ?? false,
    emailOtpEnabled: true, // email OTP is always active — not toggleable
    devices
  };
};

const verifyToken = async (userId: string, token: string): Promise<boolean> => {
  const user = await AuthModel.findById(userId);
  if (!user) return false;

  const devices = user.twoFactorAuth?.devices ?? [];
  for (const device of devices) {
    try {
      const secret = decrypt(device.encryptedSecret);
      if (verifyTotpToken(token, secret)) return true;
    } catch {
      // skip corrupted device entries
    }
  }
  return false;
};

export const TotpService = {
  generateSetup,
  verifyAndAddDevice,
  removeDevice,
  getDevices,
  verifyToken
};

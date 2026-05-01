import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import { AppError } from "./appError";
import { certificateVerifyEndPoint, httpStatus } from "../constants";
import { logger } from "./logger";
import config from "config";

const tempDir = path.join(__dirname, "../temp");

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

export const generateQRCodeFile = async (certificateShortId: string): Promise<string> => {
  try {
    const clientUrl = config.get<string>("server.clientUrl");
    const verificationUrl = `${clientUrl}/${certificateVerifyEndPoint}/${certificateShortId}`;

    const tempPath = path.join(tempDir, `qr_${certificateShortId}.png`);

    await QRCode.toFile(tempPath, verificationUrl, {
      errorCorrectionLevel: "M",
      type: "png",
      margin: 0.5,
      color: {
        dark: "#000000",
        light: "#FFFFFF"
      }
    });

    if (fs.existsSync(tempPath)) {
      const stats = fs.statSync(tempPath);
      logger.info("QR Code generated", { path: tempPath, size: stats.size });
    } else {
      throw new Error("QR code file was not created!");
    }

    return tempPath;
  } catch (error) {
    logger.error("QR code file generation error:", error);
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "QR_CODE_ERROR", "Failed to generate QR code file");
  }
};

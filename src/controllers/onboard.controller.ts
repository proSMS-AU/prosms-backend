import { Request, Response } from "express";
import { OnboardServices } from "../services/onboard.service";
import { SendSuccessResponse } from "../utils";
import { RegisterOrganizationInput, SendOnboardUrlInput } from "../schemas/super-admin/onboard.schema";
import { AppError } from "../utils/appError";
import { httpStatus } from "../constants";
import { CloudflareService } from "../services/cloudflare.service";

const sendOnboardUrlHandler = async (req: Request, res: Response) => {
  const url = await OnboardServices.sendOnboardTokenToUser(req.body as SendOnboardUrlInput);
  SendSuccessResponse.success({
    res,
    message: "Onboard URL sent successfully",
    data: url
  });
};

const verifyOnboardTokenHandler = async (req: Request, res: Response) => {
  const { token } = req.query;
  const { rto, email } = await OnboardServices.verifyOnboardToken(token as string);
  SendSuccessResponse.success({
    res,
    message: "Onboard token verified successfully",
    data: { rto, email }
  });
};

const registerOrganizationHandler = async (req: Request, res: Response) => {
  const { organization, qualifications, units, stats } = await OnboardServices.registerOrganization(
    req.body as RegisterOrganizationInput
  );
  SendSuccessResponse.success({
    res,
    message: "Organization registered successfully!",
    data: {
      organization,
      qualifications,
      units,
      stats
    }
  });
};

const uploadLogoHandler = async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "No logo file provided");
  }

  // Upload buffer to R2
  const uploadResult = await CloudflareService.uploadBufferToR2(req.file.buffer, req.file.originalname, "logos", false);

  if (!uploadResult.success) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "UPLOAD_FAILED",
      uploadResult.message || "Failed to upload logo"
    );
  }

  SendSuccessResponse.success({
    res,
    message: "Logo uploaded successfully!",
    data: {
      logoUrl: uploadResult.publicUrl,
      logoKey: uploadResult.key
    }
  });
};

export const OnboardController = {
  sendOnboardUrlHandler,
  verifyOnboardTokenHandler,
  registerOrganizationHandler,
  uploadLogoHandler
};

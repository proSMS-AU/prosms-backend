import { Request, Response, Router } from "express";
import { asyncWrapper, uploadDocxMiddleware } from "../utils";
import { validateResource } from "../middleware";
import { demoEchoSchema } from "../schemas";
import { demoEchoHandler } from "../controllers";
import { AppError } from "../utils/appError";
import { httpStatus } from "../constants";
import { CloudflareService } from "../services/cloudflare.service";
import { TGAService } from "../services/tga.service";

const router = Router();

router.post("/echo", validateResource(demoEchoSchema), asyncWrapper(demoEchoHandler));
router.post(
  "/echo-file",
  uploadDocxMiddleware,
  asyncWrapper(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Template file is required");
    }

    const filePath = req.file.path;
    const uploadRes = await CloudflareService.uploadFileR2WithAutoKey(filePath, "demo-uploads", false); // NOTE: third param is to mention whether we want a direct download link or a preview link.
    if (!uploadRes.success) {
      if (uploadRes.code === 404) {
        throw new AppError(httpStatus.NOT_FOUND, "FILE_NOT_FOUND", "The specified file was not found for upload");
      }
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", uploadRes.message || "File upload failed");
    }

    const publicUrl = uploadRes.message;

    res.status(httpStatus.OK).json({
      success: true,
      message: "File uploaded successfully",
      data: {
        publicUrl
      }
    });
  })
);

router
  .get(
    "/test-tga-search-qualifications",
    asyncWrapper(async (req: Request, res: Response) => {
      const { searchText } = req.query;
      if (!searchText || typeof searchText !== "string") {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "BAD_REQUEST",
          "searchText query parameter is required and must be a string"
        );
      }

      const searchResults = await TGAService.searchQualifications(searchText);

      res.status(httpStatus.OK).json({
        success: true,
        message: "Qualifications search successful",
        data: { searchResults }
      });
    })
  )
  .get(
    "/test-tga-qualification-details/:qualificationCode",
    asyncWrapper(async (req: Request, res: Response) => {
      const { qualificationCode } = req.params;
      if (!qualificationCode || typeof qualificationCode !== "string") {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "BAD_REQUEST",
          "qualificationCode parameter is required and must be a string"
        );
      }

      const qualificationDetails = await TGAService.findQualificationReleaseInfoAndUnits(qualificationCode);

      res.status(httpStatus.OK).json({
        success: true,
        message: "Qualification details retrieval successful",
        data: { qualificationDetails }
      });
    })
  )
  .get(
    "/test-tga-unit-search",
    asyncWrapper(async (req: Request, res: Response) => {
      const { searchText } = req.query;
      if (!searchText || typeof searchText !== "string") {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "BAD_REQUEST",
          "searchText parameter is required and must be a string"
        );
      }

      const unitDetails = await TGAService.searchUnit(searchText);

      res.status(httpStatus.OK).json({
        success: true,
        message: "Unit details retrieval successful",
        data: { unitDetails }
      });
    })
  )
  .get(
    "/test-tga-org-owned-qualifications-units/:organisationCode",
    asyncWrapper(async (req: Request, res: Response) => {
      const { organisationCode } = req.params;
      if (!organisationCode || typeof organisationCode !== "string") {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "BAD_REQUEST",
          "organisationCode parameter is required and must be a string"
        );
      }

      const orgDetails = await TGAService.findQualificationsAndUnitsOfOrganisation(organisationCode);

      res.status(httpStatus.OK).json({
        success: true,
        message: "Organisation's owned qualifications and units retrieval successful",
        data: orgDetails
      });
    })
  );

export default router;

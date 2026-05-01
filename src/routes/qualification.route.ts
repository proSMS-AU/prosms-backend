import { Request, Response, Router } from "express";
import { asyncWrapper, uploadDocxMiddleware } from "../utils";
import { validateResource } from "../middleware";
import { demoEchoSchema } from "../schemas";
import { demoEchoHandler } from "../controllers";
import { AppError } from "../utils/appError";
import { httpStatus } from "../constants";
import { CloudflareService } from "../services/cloudflare.service";
import { QualificationControllers } from "../controllers/qualification.controller";
import { QualificationCreateRequestSchema, QualificationUpdateRequestSchema } from "../schemas/qualification.schema";
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

    // const publicUrl = uploadRes.publicUrl;
    const publicUrl = uploadRes.success;

    res.status(httpStatus.OK).json({
      success: true,
      message: "File uploaded successfully",
      data: {
        publicUrl
      }
    });
  })
);

router.get("/search", asyncWrapper(QualificationControllers.searchQualificationsHandler));
router.get("/details/:qualificationCode", asyncWrapper(QualificationControllers.getQualificationDetailsHandler));
router.get("/search-units", asyncWrapper(QualificationControllers.searchUnitsHandler));
router.get(
  "/owned-qualifications-units/:organisationCode",
  asyncWrapper(QualificationControllers.getQualificationsAndUnitsOfOrganisationHandler)
);

router.get("/", QualificationControllers.getAllQualificationsHandler);

router.get("/:id", asyncWrapper(QualificationControllers.getQualificationByIdHandler));

router.post(
  "/with-units",
  validateResource(QualificationCreateRequestSchema),
  asyncWrapper(QualificationControllers.createQualificationWithUnitsHandler)
);

router.patch(
  "/with-units/:id",
  validateResource(QualificationUpdateRequestSchema),
  asyncWrapper(QualificationControllers.updateQualificationWithUnitsHandler)
);

router.delete("/:id", asyncWrapper(QualificationControllers.deleteQualificationHandler));
router.get("/:rtoId/:ABN", asyncWrapper(QualificationControllers.verifyABNHandler));

export default router;

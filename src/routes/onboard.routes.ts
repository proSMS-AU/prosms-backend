import { Router } from "express";
import { asyncWrapper } from "../utils";
import { OnboardController } from "../controllers/onboard.controller";
import { validateResource } from "../middleware";
import {
  RegisterOrganizationCreateRequestSchema,
  sendOnboardUrlSchema,
  verifyOnboardTokenSchema
} from "../schemas/super-admin/onboard.schema";
import { uploadLogoMiddleware } from "../utils/multer";

const router = Router();

router.post("/send-url", validateResource(sendOnboardUrlSchema), asyncWrapper(OnboardController.sendOnboardUrlHandler));

router.get(
  "/verify-token",
  validateResource(verifyOnboardTokenSchema),
  asyncWrapper(OnboardController.verifyOnboardTokenHandler)
);

// onboard.routes.ts
router.post("/upload-logo", uploadLogoMiddleware, asyncWrapper(OnboardController.uploadLogoHandler));

router.post(
  "/register-organization",
  validateResource(RegisterOrganizationCreateRequestSchema),
  asyncWrapper(OnboardController.registerOrganizationHandler)
);

export default router;

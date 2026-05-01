import { Router } from "express";
import { asyncWrapper } from "../utils";
import { TemplateController } from "../controllers/template.controller";
import { uploadMultipleDocxMiddleware } from "../utils/multer";

const router = Router();

// Use uploadMultipleDocxMiddleware for all routes that handle file uploads, it supports both single file (template) and multiple files (templatePage1, templatePage2)

router.post("/", uploadMultipleDocxMiddleware, asyncWrapper(TemplateController.uploadTemplateHandler));
router.get("/grouped", asyncWrapper(TemplateController.getTemplatesGroupedByTypeHandler));
router.get("/created-by/sa", asyncWrapper(TemplateController.getSATemplatesHandler));
router.get("/:templateId", asyncWrapper(TemplateController.getTemplateByIdHandler));

router.patch("/:templateId", uploadMultipleDocxMiddleware, asyncWrapper(TemplateController.updateTemplateHandler));
router.delete("/:templateId", asyncWrapper(TemplateController.deleteTemplateHandler));

export default router;

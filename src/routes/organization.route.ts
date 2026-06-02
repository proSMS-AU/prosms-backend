import { Router } from "express";
import multer from "multer";
import { organizationControllers } from "../controllers/organization.controller";
import { NatImportController } from "../controllers/nat-import.controller";
import { asyncWrapper } from "../utils";

const natUpload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.get("/", asyncWrapper(organizationControllers.getAllOrganizationsHandler));

router.get("/me", asyncWrapper(organizationControllers.getOrganizationHandler));

router.get("/stats", asyncWrapper(organizationControllers.getOrganizationStatsHandler));

router.get("/:id", asyncWrapper(organizationControllers.getOrganizationByIdHandler));

router.patch("/:id", asyncWrapper(organizationControllers.updateOrganizationHandler));

router.post(
  "/:orgId/import-nat",
  natUpload.fields([{ name: "nat00080", maxCount: 1 }, { name: "nat00085", maxCount: 1 }]),
  asyncWrapper(NatImportController.importNatHandler)
);

export default router;

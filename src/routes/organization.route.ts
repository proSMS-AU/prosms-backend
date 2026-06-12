import { Router } from "express";
import multer from "multer";
import { organizationControllers } from "../controllers/organization.controller";
import { NatImportController } from "../controllers/nat-import.controller";
import { asyncWrapper } from "../utils";

const natUpload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.get("/", asyncWrapper(organizationControllers.getAllOrganizationsHandler));

router.get("/me", asyncWrapper(organizationControllers.getOrganizationHandler));

// Whitelisted — accessible even for deleted-org sessions (requireUser lets this
// path through the ORG_DISABLED gate so the disabled screen can fetch org info).
router.get("/disabled-info", asyncWrapper(organizationControllers.getDisabledOrgInfoHandler));

router.get("/stats", asyncWrapper(organizationControllers.getOrganizationStatsHandler));

router.get("/:id", asyncWrapper(organizationControllers.getOrganizationByIdHandler));

router.patch("/:id", asyncWrapper(organizationControllers.updateOrganizationHandler));

router.delete("/:id", asyncWrapper(organizationControllers.deleteOrganizationHandler));

router.post(
  "/:orgId/import-nat",
  natUpload.fields([{ name: "zip", maxCount: 1 }]),
  asyncWrapper(NatImportController.importNatHandler)
);

export default router;

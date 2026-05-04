import { Router } from "express";
import { organizationControllers } from "../controllers/organization.controller";
import { asyncWrapper } from "../utils";

const router = Router();

router.get("/", asyncWrapper(organizationControllers.getAllOrganizationsHandler));

router.get("/me", asyncWrapper(organizationControllers.getOrganizationHandler));

router.get("/stats", asyncWrapper(organizationControllers.getOrganizationStatsHandler));

router.get("/:id", asyncWrapper(organizationControllers.getOrganizationByIdHandler));

export default router;

import { Router } from "express";
import { validateResource } from "../middleware";
import { asyncWrapper } from "../utils";
import { LocationController } from "../controllers/location.controller";
import { LocationRequestSchema } from "../schemas/location.schema";

const router = Router();

router.post("/", validateResource(LocationRequestSchema), asyncWrapper(LocationController.createLocationHandler));
router.get("/", asyncWrapper(LocationController.getAllLocationsHandler));
router.delete("/:id", asyncWrapper(LocationController.deleteLocationHandler));

export default router;

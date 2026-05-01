import { Router } from "express";
import { asyncWrapper } from "../utils";
import { UnitControllers } from "../controllers/unit.controller";

const router = Router();

router.get("/", asyncWrapper(UnitControllers.getAllUnitsHandler));

router.get("/:id", asyncWrapper(UnitControllers.getUnitByIdHandler));

router.get("/by-qualification/:id", asyncWrapper(UnitControllers.getUnitsByQualificationIdHandler));

router.post("/by-qualifications-ids", asyncWrapper(UnitControllers.getUnitsByQualificationsIdsHandler));

router.post("/by-units-ids", asyncWrapper(UnitControllers.getUnitsByUnitsIdsHandler));

export default router;

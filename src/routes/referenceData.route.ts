import { Router } from "express";
import { referenceDataController } from "../controllers/referenceData.controller";

const router = Router();

router.get("/countries", referenceDataController.countriesHandler);
router.get("/languages", referenceDataController.languagesHandler);

export default router;

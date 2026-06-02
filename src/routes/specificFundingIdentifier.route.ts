import { Router } from "express";
import { asyncWrapper } from "../utils";
import { SpecificFundingIdentifierControllers } from "../controllers/specificFundingIdentifier.controller";

const router = Router();

router.get("/", asyncWrapper(SpecificFundingIdentifierControllers.listHandler));
router.post("/", asyncWrapper(SpecificFundingIdentifierControllers.createHandler));
router.patch("/:id", asyncWrapper(SpecificFundingIdentifierControllers.updateHandler));
router.delete("/:id", asyncWrapper(SpecificFundingIdentifierControllers.deleteHandler));

export default router;

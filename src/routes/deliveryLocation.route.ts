import { Router } from "express";
import { asyncWrapper } from "../utils";
import { DeliveryLocationController } from "../controllers/deliveryLocation.controller";

const router = Router();

router.get("/", asyncWrapper(DeliveryLocationController.listHandler));
router.post("/", asyncWrapper(DeliveryLocationController.createHandler));
router.patch("/:id", asyncWrapper(DeliveryLocationController.updateHandler));
router.delete("/:id", asyncWrapper(DeliveryLocationController.deleteHandler));

export default router;

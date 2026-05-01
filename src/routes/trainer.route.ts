import { Router } from "express";
import { validateResource } from "../middleware";
import { TrainerRequestSchema, UpdateTrainerRequestSchema } from "../schemas/trainer.schema";
import { asyncWrapper } from "../utils";
import { trainerControllers } from "../controllers/trainer.controller";

const router = Router();

router.post("/", validateResource(TrainerRequestSchema), asyncWrapper(trainerControllers.addTrainerHandler));

router.get("/", asyncWrapper(trainerControllers.getAllTrainersHandler));

router.get("/:id", asyncWrapper(trainerControllers.getTrainerByIdHandler));

router.patch(
  "/:id",
  validateResource(UpdateTrainerRequestSchema),
  asyncWrapper(trainerControllers.updateTrainerHandler)
);

router.delete("/:id", asyncWrapper(trainerControllers.deleteTrainerHandler));

export default router;

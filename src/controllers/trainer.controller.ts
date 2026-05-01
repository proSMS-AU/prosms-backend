import { Request, Response } from "express";
import { TrainerServices } from "../services/trainer.service";
import { SendSuccessResponse } from "../utils";

const addTrainerHandler = async (req: Request, res: Response) => {
  const trainer = await TrainerServices.addTrainer(req.body, req.user?.organizationId as string);
  SendSuccessResponse.created({
    res,
    message: "Trainer Added successfully!",
    data: trainer
  });
};

const getAllTrainersHandler = async (req: Request, res: Response) => {
  const { trainers, total, page, limit, totalPages } = await TrainerServices.getAllTrainers(
    req.query as Record<string, string>,
    req.user?.organizationId as string
  );
  SendSuccessResponse.success({
    res,
    message: "All trainers retrieved successfully!",
    meta: {
      total,
      page,
      limit,
      totalPages
    },
    data: trainers
  });
};

const getTrainerByIdHandler = async (req: Request, res: Response) => {
  const trainer = await TrainerServices.getTrainerById(req.params.id);
  SendSuccessResponse.success({
    res,
    message: "A trainer data retrieved successfully!",
    data: trainer
  });
};

const updateTrainerHandler = async (req: Request, res: Response) => {
  const trainer = await TrainerServices.updateTrainer(req.params.id, req.body);
  SendSuccessResponse.updated({
    res,
    message: "Trainer updated successfully!",
    data: trainer
  });
};

const deleteTrainerHandler = async (req: Request, res: Response) => {
  await TrainerServices.deleteTrainer(req.params.id);
  SendSuccessResponse.deleted({
    res,
    message: "Trainer deleted successfully!",
    data: null
  });
};

export const trainerControllers = {
  addTrainerHandler,
  getAllTrainersHandler,
  getTrainerByIdHandler,
  updateTrainerHandler,
  deleteTrainerHandler
};

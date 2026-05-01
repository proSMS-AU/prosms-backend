import { AddTrainerT, UpdateTrainerT } from "../schemas/trainer.schema";
import { TrainerModel } from "../model/trainer.model";
import { QueryBuilder } from "../utils/queryBuilder";
import { CONFLICT_ERROR, DATA_NOT_FOUND, httpStatus } from "../constants";
import { AppError } from "../utils/appError";
import { flattenUpdate } from "./student.service";
import { ClassModel } from "../model/class.model";
import { generateSequentialId } from "../utils/sequentialIdGenerator";

const addTrainer = async (data: AddTrainerT, organizationId: string) => {
  const existingTrainer = await TrainerModel.findOne({
    "personalInfo.email": data?.personalInfo.email
  });
  if (existingTrainer) {
    throw new AppError(httpStatus.CONFLICT, CONFLICT_ERROR.code, "Trainer already exists with this email!");
  }
  const employeeId = await generateSequentialId({
    key: `trainer:${organizationId}`,
    prefix: "EMP",
    pad: 6
  });
  const newTrainer = await TrainerModel.create({
    ...data,
    organizationId,
    employeeId
  });
  return newTrainer;
};

const getAllTrainers = async (query: Record<string, string>, organizationId: string) => {
  const queryBuilder = new QueryBuilder(TrainerModel.find({ organizationId }), query);
  const searchableFields = [
    "employeeId",
    "personalInfo.givenName",
    "personalInfo.middleName",
    "personalInfo.surname",
    "personalInfo.preferredName",
    "personalInfo.email",
    "personalInfo.phone",
    "address.city",
    "address.state",
    "address.postCode",
    "address.country",
    "address.street",
    "address.building",
    "address.unit"
  ];
  const trainers = await queryBuilder.search(searchableFields).filter().sort().select().pagination().build();

  const meta = await queryBuilder.getMeta();
  return {
    trainers,
    ...meta
  };
};

const getTrainerById = async (trainerId: string) => {
  const trainer = await TrainerModel.findById(trainerId);
  if (!trainer) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, DATA_NOT_FOUND.message);
  }
  return trainer;
};

const updateTrainer = async (trainerId: string, data: UpdateTrainerT) => {
  if (data?.personalInfo?.email) {
    const existingTrainer = await TrainerModel.findOne({
      "personalInfo.email": data?.personalInfo?.email,
      _id: { $ne: trainerId }
    });

    if (existingTrainer) {
      throw new AppError(httpStatus.CONFLICT, CONFLICT_ERROR.code, CONFLICT_ERROR.message);
    }
  }

  const trainer = await TrainerModel.findByIdAndUpdate(
    trainerId,
    { $set: flattenUpdate(data) },
    {
      new: true,
      runValidators: false
    }
  );
  if (!trainer) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, DATA_NOT_FOUND.message);
  }
  return trainer;
};

const deleteTrainer = async (trainerId: string) => {
  // Prevent deletion if trainer is assigned
  const assignedClasses = await ClassModel.countDocuments({
    $or: [{ "classDetails.defaultTrainer": trainerId }, { "classDetails.additionalTrainer": trainerId }]
  });

  if (assignedClasses > 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "TRAINER_IN_USE", "Cannot delete assigned trainer!");
  }

  const trainer = await TrainerModel.findByIdAndDelete(trainerId);
  if (!trainer) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, DATA_NOT_FOUND.message);
  }
};

export const TrainerServices = {
  addTrainer,
  getAllTrainers,
  getTrainerById,
  updateTrainer,
  deleteTrainer
};

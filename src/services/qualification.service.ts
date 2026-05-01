/* eslint-disable @typescript-eslint/no-explicit-any */

import mongoose from "mongoose";
import { QualificationModel } from "../model/qualification.model";
import { UnitModel } from "../model/unit.model";
import { IQualificationCreate, IQualificationUpdate } from "../schemas/qualification.schema";
import { QueryBuilder } from "../utils/queryBuilder";
import { AppError } from "../utils/appError";
import { httpStatus } from "../constants";

const createQualificationWithUnits = async (data: IQualificationCreate) => {
  const session = await mongoose.startSession();

  try {
    // Start transaction
    session.startTransaction();

    const isQualificationCodeExist = await QualificationModel.findOne({
      code: data.qualification.code,
      organizationId: data.organizationId
    }).session(session);
    if (isQualificationCodeExist) {
      throw new AppError(
        httpStatus.CONFLICT,
        "QUALIFICATION_ALREADY_FOUND",
        "Qualification already exist with this code"
      );
    }

    // Create qualification with organizationId
    const qualificationData = {
      ...data.qualification,
      organizationId: data.organizationId
    };

    // Add ordered: true for create with session
    const [qualification] = await QualificationModel.create([qualificationData], {
      session,
      ordered: true
    });

    // Create units with qualificationId and organizationId
    const unitsData = data.units.map((unit) => ({
      ...unit,
      qualificationId: qualification._id.toString(),
      organizationId: data.organizationId
    }));

    // Add ordered: true for create with session
    const units = await UnitModel.create(unitsData, {
      session,
      ordered: true
    });

    // Commit transaction
    await session.commitTransaction();

    return {
      qualification,
      units
    };
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    throw error;
  } finally {
    // End session
    session.endSession();
  }
};

const getAllQualifications = async (query: Record<string, string>, organizationId: string) => {
  const queryBuilder = new QueryBuilder(QualificationModel.find({ organizationId }), query);
  const searchableFields = [
    "organizationId",
    "code",
    "title",
    "status",
    "latestReleaseInfo.releaseDate",
    "latestReleaseInfo.releaseNumber"
  ];
  const qualifications = await queryBuilder.search(searchableFields).filter().sort().select().pagination().build();

  const meta = await queryBuilder.getMeta();
  return {
    qualifications,
    ...meta
  };
};

const getQualificationById = async (id: string) => {
  const qualification = await QualificationModel.findById(id);

  if (!qualification) {
    throw new AppError(httpStatus.NOT_FOUND, "QUALIFICATION_NOT_FOUND", "Qualification not found");
  }

  const units = await UnitModel.find({ qualificationId: id });

  return {
    qualification,
    units
  };
};

const updateQualificationWithUnits = async (
  qualificationId: string,
  data: IQualificationUpdate & { organizationId: string }
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Verify qualification exists and belongs to organization
    const existingQualification = await QualificationModel.findOne({
      _id: qualificationId,
      organizationId: data.organizationId
    }).session(session);

    if (!existingQualification) {
      throw new AppError(httpStatus.NOT_FOUND, "QUALIFICATION_NOT_FOUND", "Qualification not found");
    }

    // Update qualification
    const updatedQualification = await QualificationModel.findByIdAndUpdate(
      qualificationId,
      { $set: data.qualification },
      { new: true, session, runValidators: true }
    );

    let updatedUnits: any = [];

    // Handle units update if provided
    if (data.units && data.units.length > 0) {
      // Get existing unit codes for this qualification
      const existingUnits = await UnitModel.find({
        qualificationId,
        organizationId: data.organizationId
      }).session(session);

      const existingUnitCodes = existingUnits.map((u) => u.code);
      const newUnitCodes = data.units.map((u) => u.code);

      // Units to delete (exist in DB but not in new data)
      const unitsToDelete = existingUnitCodes.filter((code) => !newUnitCodes.includes(code));

      // Units to add (exist in new data but not in DB)
      const unitsToAdd = data.units.filter((unit) => !existingUnitCodes.includes(unit.code));

      // Units to update (exist in both)
      const unitsToUpdate = data.units.filter((unit) => existingUnitCodes.includes(unit.code));

      // Delete removed units
      if (unitsToDelete.length > 0) {
        await UnitModel.deleteMany(
          {
            qualificationId,
            organizationId: data.organizationId,
            code: { $in: unitsToDelete }
          },
          { session }
        );
      }

      // Add new units
      if (unitsToAdd.length > 0) {
        const newUnitsData = unitsToAdd.map((unit) => ({
          ...unit,
          qualificationId,
          organizationId: data.organizationId
        }));

        await UnitModel.create(newUnitsData, { session, ordered: true });
      }

      // Update existing units
      for (const unit of unitsToUpdate) {
        // eslint-disable-next-line no-await-in-loop
        await UnitModel.findOneAndUpdate(
          {
            qualificationId,
            organizationId: data.organizationId,
            code: unit.code
          },
          { $set: unit },
          { session, runValidators: true }
        );
      }

      // Fetch all updated units
      updatedUnits = await UnitModel.find({
        qualificationId,
        organizationId: data.organizationId
      }).session(session);
    }

    await session.commitTransaction();

    return {
      qualification: updatedQualification,
      units: updatedUnits
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const deleteQualification = async (id: string) => {
  // checking is there any associated units
  const childUnits = await UnitModel.find({ qualificationId: id });
  if (childUnits.length > 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "QUALIFICATION_IN_USE", "Cannot delete assigned qualification!");
  }

  const qualification = await QualificationModel.findByIdAndDelete(id);
  if (!qualification) {
    throw new AppError(httpStatus.NOT_FOUND, "QUALIFICATION_NOT_FOUND", "Qualification not found");
  }
};

export const QualificationServices = {
  createQualificationWithUnits,
  updateQualificationWithUnits,
  getAllQualifications,
  getQualificationById,
  deleteQualification
};

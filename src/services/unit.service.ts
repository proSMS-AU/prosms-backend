import { DATA_NOT_FOUND, httpStatus } from "../constants";
import { UnitModel } from "../model/unit.model";
import { AppError } from "../utils/appError";
import { QueryBuilder } from "../utils/queryBuilder";

const getAllUnits = async (query: Record<string, string>) => {
  const queryBuilder = new QueryBuilder(UnitModel.find(), query);
  const searchableFields = [
    "code",
    "isEssentialLabel",
    "qualificationCode",
    "title",
    "usageRecommendationLabel",
    "status"
  ];
  const units = await queryBuilder.search(searchableFields).filter().sort().select().pagination().build();
  const meta = await queryBuilder.getMeta();
  return {
    units,
    ...meta
  };
};

const getUnitsByQualificationId = async (id: string) => {
  const units = await UnitModel.find({ qualificationId: id });
  return units;
};

const getUnitsByQualificationsIds = async (ids: string[]) => {
  const units = await UnitModel.find({ qualificationId: { $in: ids } });
  return units;
};

const getUnitById = async (id: string) => {
  const unit = await UnitModel.findById(id);
  if (!unit) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Unit not found");
  }
  return unit;
};

const getUnitsByUnitsIds = async (ids: string[]) => {
  const units = await UnitModel.find({ _id: { $in: ids } });
  return units;
};

export const UnitServices = {
  getAllUnits,
  getUnitsByQualificationId,
  getUnitsByQualificationsIds,
  getUnitById,
  getUnitsByUnitsIds
};

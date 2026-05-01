import { Request, Response } from "express";
import { SendSuccessResponse } from "../utils";
import { UnitServices } from "../services/unit.service";

const getAllUnitsHandler = async (req: Request, res: Response) => {
  const { units, total, page, limit, totalPages } = await UnitServices.getAllUnits(req.query as Record<string, string>);
  SendSuccessResponse.success({
    res,
    message: "All units retrieved successfully!",
    data: units,
    meta: {
      total,
      page,
      limit,
      totalPages
    }
  });
};

const getUnitsByQualificationIdHandler = async (req: Request, res: Response) => {
  const units = await UnitServices.getUnitsByQualificationId(req.params.id);
  SendSuccessResponse.success({
    res,
    message: "Units of a qualification retrieved successfully!",
    meta: {
      total: units.length
    },
    data: units
  });
};

const getUnitsByQualificationsIdsHandler = async (req: Request, res: Response) => {
  const ids = req.body.qualificationIds || [];
  const units = await UnitServices.getUnitsByQualificationsIds(ids);
  SendSuccessResponse.success({
    res,
    message: "Units of qualifications retrieved successfully!",
    meta: {
      total: units.length
    },
    data: units
  });
};

const getUnitByIdHandler = async (req: Request, res: Response) => {
  const unit = await UnitServices.getUnitById(req.params.id);
  SendSuccessResponse.success({
    res,
    message: "Unit retrieved successfully!",
    data: unit
  });
};

const getUnitsByUnitsIdsHandler = async (req: Request, res: Response) => {
  const ids = req.body.unitIds || [];
  const units = await UnitServices.getUnitsByUnitsIds(ids);
  SendSuccessResponse.success({
    res,
    message: "Units retrieved successfully!",
    meta: {
      total: units.length
    },
    data: units
  });
};

export const UnitControllers = {
  getAllUnitsHandler,
  getUnitsByQualificationIdHandler,
  getUnitsByQualificationsIdsHandler,
  getUnitByIdHandler,
  getUnitsByUnitsIdsHandler
};

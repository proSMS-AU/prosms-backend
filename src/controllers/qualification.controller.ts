/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextFunction, Request, Response } from "express";
import { TGAService } from "../services/tga.service";
import { AppError } from "../utils/appError";
import { SendSuccessResponse } from "../utils";
import { httpStatus } from "../constants";
import { QualificationServices } from "../services/qualification.service";

const searchQualificationsHandler = async (req: Request, res: Response) => {
  const { searchText } = req.query;

  if (!searchText || typeof searchText !== "string") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "BAD_REQUEST",
      "searchText query parameter is required and must be a string"
    );
  }

  const searchResults = await TGAService.searchQualifications(searchText);

  // This keeps only ONE item from duplicates
  const uniqueQualifications = searchResults.filter((item, index, self) => {
    return self.findIndex((item2) => item2?.nrtId === item?.nrtId && item2?.code === item?.code) === index;
  });

  SendSuccessResponse.success({
    res,
    message: "Qualifications fetched successfully",
    data: uniqueQualifications
  });
};

const getQualificationDetailsHandler = async (req: Request, res: Response) => {
  const { qualificationCode } = req.params;

  if (!qualificationCode || typeof qualificationCode !== "string") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "BAD_REQUEST",
      "qualificationCode parameter is required and must be a string"
    );
  }

  const qualificationDetails = await TGAService.findQualificationReleaseInfoAndUnits(qualificationCode);

  if (!qualificationDetails) {
    throw new AppError(httpStatus.NOT_FOUND, "NOT_FOUND", "Qualification not found with the provided code");
  }

  SendSuccessResponse.success({
    res,
    message: "Qualification details fetched successfully",
    data: qualificationDetails
  });
};

const searchUnitsHandler = async (req: Request, res: Response) => {
  const { searchText } = req.query;

  if (!searchText || typeof searchText !== "string") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "BAD_REQUEST",
      "searchText query parameter is required and must be a string"
    );
  }

  const searchResults = await TGAService.searchUnit(searchText);

  SendSuccessResponse.success({
    res,
    message: "Units fetched successfully",
    data: searchResults
  });
};

const getQualificationsAndUnitsOfOrganisationHandler = async (req: Request, res: Response) => {
  const { organisationCode } = req.params;

  if (!organisationCode || typeof organisationCode !== "string") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "BAD_REQUEST",
      "organisationCode parameter is required and must be a string"
    );
  }

  const qualificationsAndUnits = await TGAService.findQualificationsAndUnitsOfOrganisation(organisationCode);

  SendSuccessResponse.success({
    res,
    message: "Qualifications and units fetched successfully",
    data: qualificationsAndUnits
  });
};

const getAllQualificationsHandler = async (req: Request, res: Response) => {
  const { qualifications, total, page, limit, totalPages } = await QualificationServices.getAllQualifications(
    req.query as Record<string, string>,
    req.user!.organizationId as string
  );

  SendSuccessResponse.success({
    res,
    message: "Qualifications fetched successfully",
    meta: {
      total,
      page,
      limit,
      totalPages
    },
    data: qualifications
  });
};

const getQualificationByIdHandler = async (req: Request, res: Response) => {
  const { qualification, units } = await QualificationServices.getQualificationById(req.params.id);
  SendSuccessResponse.success({
    res,
    message: "Qualification fetched successfully",
    data: { qualification, assignedUnits: units }
  });
};

const createQualificationWithUnitsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qualification, units } = req.body;
    const organizationId = req.user!.organizationId as string;
    const result = await QualificationServices.createQualificationWithUnits({
      qualification,
      units,
      organizationId
    });

    return SendSuccessResponse.created({
      message: "Qualification with units created successfully",
      data: result,
      res
    });
  } catch (error: any) {
    next(error);
  }
};

const updateQualificationWithUnitsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { qualification, units } = req.body;
    const organizationId = req.user!.organizationId as string;

    const result = await QualificationServices.updateQualificationWithUnits(id, {
      qualification,
      units,
      organizationId
    });

    return SendSuccessResponse.updated({
      message: "Qualification updated successfully",
      data: result,
      res
    });
  } catch (error: any) {
    next(error);
  }
};

const deleteQualificationHandler = async (req: Request, res: Response) => {
  await QualificationServices.deleteQualification(req.params.id, req.user?._id);
  return SendSuccessResponse.deleted({
    res,
    message: "Qualification deleted successfully",
    data: null
  });
};

const verifyABNHandler = async (req: Request, res: Response) => {
  const verifyABN = await TGAService.verifyABN(req.params.rtoId, req.params.ABN);
  SendSuccessResponse.success({
    res,
    message: "ABN verified successfully!",
    data: verifyABN
  });
};

export const QualificationControllers = {
  searchQualificationsHandler,
  getQualificationDetailsHandler,
  searchUnitsHandler,
  getQualificationsAndUnitsOfOrganisationHandler,
  getAllQualificationsHandler,
  getQualificationByIdHandler,
  createQualificationWithUnitsHandler,
  updateQualificationWithUnitsHandler,
  deleteQualificationHandler,
  verifyABNHandler
};

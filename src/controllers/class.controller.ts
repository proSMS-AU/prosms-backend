import { ClassServices } from "../services/class.service";
import { Request, Response } from "express";
import { SendSuccessResponse } from "../utils";

const addClassHandler = async (req: Request, res: Response) => {
  const newClass = await ClassServices.addClass(req.body, req.user?.organizationId as string);
  SendSuccessResponse.created({
    res,
    message: "Class Created successfully!",
    data: newClass
  });
};

const getAllClassesHandler = async (req: Request, res: Response) => {
  const { classes, total, page, limit, totalPages } = await ClassServices.getAllClasses(
    req.query as Record<string, string>,
    req.user?.organizationId as string
  );
  SendSuccessResponse.success({
    res,
    message: "Classes retrieved successfully!",
    meta: {
      total,
      page,
      limit,
      totalPages
    },
    data: classes
  });
};

const getClassByIdHandler = async (req: Request, res: Response) => {
  const classData = await ClassServices.getClassById(req.params.id);
  SendSuccessResponse.success({
    res,
    message: "Class retrieved successfully!",
    data: classData
  });
};

const updateClassHandler = async (req: Request, res: Response) => {
  const organizationId = req.user!.organizationId as string;
  const result = await ClassServices.updateClass(req.params.id, req.body, organizationId);

  return SendSuccessResponse.updated({
    res,
    message: "Class updated successfully!",
    data: result
  });
};

const deleteUnitsFromClassEnrollmentHandler = async (req: Request, res: Response) => {
  const result = await ClassServices.deleteUnitsFromClassEnrollment(req.body);
  SendSuccessResponse.updated({
    res,
    message: "Units deleted from class enrollment successfully!",
    data: result
  });
};

const deleteClassHandler = async (req: Request, res: Response) => {
  await ClassServices.deleteClass(req.params.id);
  SendSuccessResponse.deleted({
    res,
    message: "Class deleted successfully!",
    data: null
  });
};

const getCertificateGeneratedClassesHandler = async (req: Request, res: Response) => {
  const { classes, total, page, limit, totalPages } = await ClassServices.getCertificateGeneratedClasses(
    req.query as Record<string, string>,
    req.user?.organizationId as string
  );
  SendSuccessResponse.success({
    res,
    message: "Certificate generated classes retrieved successfully!",
    meta: {
      total,
      page,
      limit,
      totalPages
    },
    data: classes
  });
};

const getStudentEnrolledClassesHandler = async (req: Request, res: Response) => {
  const { data, meta } = await ClassServices.getStudentEnrolledClasses(
    req.params.id as string,
    req.query as Record<string, string>
  );
  SendSuccessResponse.success({
    res,
    message: "Student enrolled classes retrieved successfully!",
    meta,
    data
  });
};

// NEW: Get unique locations
const getUniqueLocationsHandler = async (req: Request, res: Response) => {
  const locations = await ClassServices.getUniqueLocations(req.user?.organizationId as string);
  SendSuccessResponse.success({
    res,
    message: "Locations retrieved successfully!",
    data: locations
  });
};

// NEW: Get unique trainers
const getUniqueTrainersHandler = async (req: Request, res: Response) => {
  const trainers = await ClassServices.getUniqueTrainers(req.user?.organizationId as string);
  SendSuccessResponse.success({
    res,
    message: "Trainers retrieved successfully!",
    data: trainers
  });
};

export const ClassControllers = {
  addClassHandler,
  getAllClassesHandler,
  getClassByIdHandler,
  updateClassHandler,
  deleteUnitsFromClassEnrollmentHandler,
  deleteClassHandler,
  getCertificateGeneratedClassesHandler,
  getStudentEnrolledClassesHandler,
  getUniqueLocationsHandler,
  getUniqueTrainersHandler
};

import { Request, Response } from "express";
import { StudentServices } from "../services/student.service";
import { EnrollmentServices } from "../services/enrollment.service";
import { SendSuccessResponse } from "../utils";
import { AppError } from "../utils/appError";
import { BAD_REQUEST, httpStatus } from "../constants";

const addNewStudentHandler = async (req: Request, res: Response) => {
  if (!req.user?.organizationId) {
    throw new AppError(httpStatus.BAD_REQUEST, BAD_REQUEST.code, "Organization ID is required");
  }
  const student = await StudentServices.addNewStudent(req.body, req.user?.organizationId as string);

  SendSuccessResponse.created({
    res,
    message: "Student Added successfully!",
    data: student
  });
};

const getAllStudentsHandler = async (req: Request, res: Response) => {
  const { students, total, page, limit, totalPages } = await StudentServices.getAllStudents(
    req.query as Record<string, string>,
    req.user?.organizationId as string
  );
  SendSuccessResponse.success({
    res,
    message: "All students retrieved successfully!",
    meta: {
      total,
      page,
      limit,
      totalPages
    },
    data: students
  });
};

const getStudentByIdHandler = async (req: Request, res: Response) => {
  const student = await StudentServices.getStudentById(req.params.id);
  SendSuccessResponse.success({
    res,
    message: "Student retrieved successfully",
    data: student
  });
};

const updateStudentHandler = async (req: Request, res: Response) => {
  const student = await StudentServices.updateStudent(req.params.id, req.body);
  SendSuccessResponse.updated({
    res,
    message: "Student updated successfully",
    data: student
  });
};

const deleteStudentHandler = async (req: Request, res: Response) => {
  await StudentServices.deleteStudent(req.params.id, req.user?._id);
  SendSuccessResponse.deleted({
    res,
    message: "Student deleted successfully",
    data: null
  });
};

// NEW: Get unique locations for filter dropdown
const getUniqueLocationsHandler = async (req: Request, res: Response) => {
  const locations = await StudentServices.getUniqueLocations(req.user?.organizationId as string);
  SendSuccessResponse.success({
    res,
    message: "Locations retrieved successfully!",
    data: locations
  });
};

// NEW: Get unique states for filter dropdown
const getUniqueStatesHandler = async (req: Request, res: Response) => {
  const states = await StudentServices.getUniqueStates(req.user?.organizationId as string);
  SendSuccessResponse.success({
    res,
    message: "States retrieved successfully!",
    data: states
  });
};

// NEW: Get unique countries for filter dropdown
const getUniqueCountriesHandler = async (req: Request, res: Response) => {
  const countries = await StudentServices.getUniqueCountries(req.user?.organizationId as string);
  SendSuccessResponse.success({
    res,
    message: "Countries retrieved successfully!",
    data: countries
  });
};

// E-01 — All classes this student is enrolled in
const getStudentEnrollmentsHandler = async (req: Request, res: Response) => {
  const enrollments = await EnrollmentServices.getStudentEnrollments(req.params.id, req.user?.organizationId as string);
  SendSuccessResponse.success({
    res,
    message: "Student enrollments retrieved successfully",
    data: enrollments
  });
};

const getDeletedStudentsHandler = async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId as string;
  const data = await StudentServices.getDeletedStudents(organizationId);
  SendSuccessResponse.success({ res, message: "Deleted students retrieved", data });
};

const restoreStudentHandler = async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId as string;
  const data = await StudentServices.restoreStudent(req.params.id, organizationId);
  SendSuccessResponse.success({ res, message: "Student restored", data });
};

const getStudentOptionsHandler = async (req: Request, res: Response) => {
  const options = await StudentServices.getStudentOptions(
    req.user?.organizationId as string,
    req.query.search as string | undefined
  );
  SendSuccessResponse.success({ res, message: "Student options retrieved", data: options });
};

export const StudentController = {
  addNewStudentHandler,
  getAllStudentsHandler,
  getStudentByIdHandler,
  updateStudentHandler,
  deleteStudentHandler,
  getDeletedStudentsHandler,
  restoreStudentHandler,
  getUniqueLocationsHandler,
  getUniqueStatesHandler,
  getUniqueCountriesHandler,
  getStudentEnrollmentsHandler,
  getStudentOptionsHandler
};

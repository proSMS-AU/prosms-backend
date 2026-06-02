import { httpStatus } from "../constants";
import { EnrollmentServices } from "../services/enrollment.service";
import { SendSuccessResponse } from "../utils";
import { Request, Response } from "express";
import { AppError } from "../utils/appError";

const addEnrollmentHandler = async (req: Request, res: Response) => {
  const enrollment = await EnrollmentServices.addEnrollment(req.body);

  SendSuccessResponse.created({
    res,
    message: "Enrolled successfully!",
    data: enrollment
  });
};

const addEnrollmentWithNotifyHandler = async (req: Request, res: Response) => {
  const enrollment = await EnrollmentServices.addEnrollmentWithNotify(req.body);

  SendSuccessResponse.created({
    res,
    message: "Enrolled and Notified successfully!",
    data: enrollment
  });
};

const updateStatusOfUnitCompletionHandler = async (req: Request, res: Response) => {
  const { classId, studentId, unitId } = req.params;
  const { status } = req.body;

  // Validate request body
  if (!status) {
    throw new AppError(httpStatus.BAD_REQUEST, "MISSING_STATUS", "Status code is required");
  }

  const result = await EnrollmentServices.updateStatusOfUnitCompletion(classId, studentId, unitId, status);

  SendSuccessResponse.updated({
    res,
    message: "Unit status updated successfully!",
    data: result
  });
};

const enrolledUnitUpdateHandler = async (req: Request, res: Response) => {
  const { classId, studentId, unitId } = req.params;
  const { status, hour, unitStartDate, unitEndDate, unitEnrollmentDate, unitCompletionDate } = req.body;

  const result = await EnrollmentServices.enrolledUnitUpdate(
    classId,
    studentId,
    unitId,
    status,
    hour,
    unitStartDate,
    unitEndDate,
    unitEnrollmentDate,
    unitCompletionDate
  );

  SendSuccessResponse.updated({
    res,
    message: "Unit updated successfully!",
    data: result
  });
};

const enrolledUnitsBulkUpdateHandler = async (req: Request, res: Response) => {
  const { classId, studentId } = req.params;
  const { unitIds, enrollmentDate, status, hour, unitStartDate, unitEndDate, unitEnrollmentDate, unitCompletionDate } =
    req.body;

  const result = await EnrollmentServices.enrolledUnitsBulkUpdate(
    classId,
    studentId,
    unitIds,
    enrollmentDate,
    status,
    hour,
    unitStartDate,
    unitEndDate,
    unitEnrollmentDate,
    unitCompletionDate
  );

  SendSuccessResponse.updated({
    res,
    message: "Units updated successfully!",
    data: result
  });
};

const unitsStatusBulkUpdateHandler = async (req: Request, res: Response) => {
  const { classId, studentIds, unitIds, status } = req.body;

  const result = await EnrollmentServices.unitsStatusBulkUpdate(classId, studentIds, unitIds, status);
  SendSuccessResponse.updated({
    res,
    message: "Unit statuses updated successfully!",
    data: result
  });
};

const updateCourseEnrollAndCompleteDateHandler = async (req: Request, res: Response) => {
  const { classId, students } = req.body;

  const result = await EnrollmentServices.updateCourseEnrollAndCompleteDate({ classId, students });
  SendSuccessResponse.updated({
    res,
    message: "Course enrollment and completion date updated successfully!",
    data: result
  });
};

// E-03 — Bulk enrol multiple students into one class
const bulkEnrollStudentsHandler = async (req: Request, res: Response) => {
  const classId = req.params.id;
  const { studentIds, unitIds } = req.body as { studentIds: string[]; unitIds: string[] };

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "studentIds must be a non-empty array");
  }

  const result = await EnrollmentServices.bulkEnrollStudents(classId, studentIds, unitIds ?? []);
  SendSuccessResponse.created({
    res,
    message: `Bulk enrol complete — ${result.success.length} enrolled, ${result.failed.length} failed`,
    data: result
  });
};

const bulkUpdateDatesHandler = async (req: Request, res: Response) => {
  const { classId, studentIds, dates } = req.body as {
    classId: string;
    studentIds: string[];
    dates: { enrollmentDate?: string; unitStartDate?: string; unitEndDate?: string };
  };
  const result = await EnrollmentServices.bulkUpdateDates(classId, studentIds, dates);
  SendSuccessResponse.updated({ res, message: `Updated dates for ${result.updatedCount} enrollment(s)`, data: result });
};

export const EnrollmentController = {
  addEnrollmentHandler,
  addEnrollmentWithNotifyHandler,
  updateStatusOfUnitCompletionHandler,
  enrolledUnitUpdateHandler,
  enrolledUnitsBulkUpdateHandler,
  unitsStatusBulkUpdateHandler,
  updateCourseEnrollAndCompleteDateHandler,
  bulkEnrollStudentsHandler,
  bulkUpdateDatesHandler
};

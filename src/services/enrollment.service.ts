/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  BAD_REQUEST,
  CONFLICT_ERROR,
  DATA_NOT_FOUND,
  ENROLLED_UNIT_COMPLETED_STATUSES,
  httpStatus,
  UNIT_COMPETENCY_MAP,
  UnitCompetencyCode
} from "../constants";
import { ClassModel } from "../model/class.model";
import { StudentModel } from "../model/student.model";
import { IUpdateCourseEnrollAndCompleteDate } from "../schemas/class.schema";
import { EnrollmentT, EnrollmentWithNotifyT } from "../schemas/enrollment.schema";
import { AppError } from "../utils/appError";
import { sendEmail } from "../utils/sendEmail";

const addEnrollment = async (enrollmentData: EnrollmentT) => {
  const classData = await ClassModel.findById(enrollmentData.classId);
  if (!classData) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Class not found to enroll student!");
  }

  const studentData = await StudentModel.findById(enrollmentData.studentId);
  if (!studentData) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Student not found to enroll in class!");
  }

  // 1. Check if the class is already ended
  const endDate = new Date(classData.classDetails.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  if (today > endDate) {
    throw new AppError(httpStatus.BAD_REQUEST, BAD_REQUEST.code, "This class has already ended!");
  }

  // 2. Prevent duplicate enrollment
  const isThisStudentAlreadyEnrolled = classData.enrollments.some(
    (enrollment: { studentInfo: { id: string } }) => enrollment.studentInfo.id === enrollmentData.studentId
  );
  if (isThisStudentAlreadyEnrolled) {
    throw new AppError(httpStatus.CONFLICT, CONFLICT_ERROR.code, "Student is already enrolled in this class!");
  }

  // 3. Check max participant limit
  if (classData.enrollments.length >= classData.classDetails.maxParticipants!) {
    throw new AppError(httpStatus.BAD_REQUEST, BAD_REQUEST.code, "Class has reached maximum participants!");
  }

  const allUnitsOfClass = [...classData.unitsInfo.selectedUnits.core, ...classData.unitsInfo.selectedUnits.elective];

  const unitsOfCompetency = enrollmentData.unitIds.map((unitId: string) => {
    const unit = allUnitsOfClass.find((unit: any) => unit.id === unitId);
    if (!unit) {
      throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Unit not found!");
    }
    return {
      id: unit.id,
      code: unit.code,
      hour: unit.hour,
      title: unit.title,
      statusOfCompletion: UNIT_COMPETENCY_MAP.NYS.code,
      classStartDate: classData.classDetails.startDate,
      classEndDate: classData.classDetails.endDate,
      unitStartDate: new Date(),
      unitEndDate: classData.classDetails.endDate,
      unitEnrollmentDate: new Date()
    };
  });

  // 4. Add enrollment
  const prepareData: any = {
    class: {
      id: classData._id,
      title: classData.classDetails.classTitle
    },
    studentInfo: {
      id: studentData._id,
      name: `${studentData.personalInfo.givenName} ${studentData.personalInfo.surname}`,
      email: studentData.contactDetails.email,
      phone: studentData.contactDetails.personalPhone,
      USI: studentData.participantsIdentifiers.USI
    },
    unitsOfCompetency: unitsOfCompetency,
    enrollmentDate: new Date()
  };

  classData.enrollments.push(prepareData);
  await classData.save();

  return classData;
};

const addEnrollmentWithNotify = async (enrollmentData: EnrollmentWithNotifyT) => {
  const classData = await ClassModel.findById(enrollmentData.classId);
  if (!classData) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, DATA_NOT_FOUND.message);
  }

  const studentData = await StudentModel.findById(enrollmentData.studentId);
  if (!studentData) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Student not found!");
  }

  // 1. Check if the class is already ended
  const endDate = new Date(classData.classDetails.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  if (today > endDate) {
    throw new AppError(httpStatus.BAD_REQUEST, "CLASS_CLOSED", "This class has already ended.");
  }

  // 2. Prevent duplicate enrollment
  const isAlreadyEnrolled = classData.enrollments.some(
    (enrollment: { studentInfo: { id: any } }) => enrollment.studentInfo.id === enrollmentData.studentId
  );

  if (isAlreadyEnrolled) {
    throw new AppError(httpStatus.CONFLICT, "CONFLICT", "Student is already enrolled in this class!");
  }

  // 3. Check max participant limit
  if (classData.enrollments.length >= classData.classDetails.maxParticipants!) {
    throw new AppError(httpStatus.BAD_REQUEST, "LIMIT_REACHED", "Class has reached maximum participants!");
  }

  const allUnitsOfClass = [...classData.unitsInfo.selectedUnits.core, ...classData.unitsInfo.selectedUnits.elective];

  const unitsOfCompetency = enrollmentData.unitIds.map((unitId: string) => {
    const unit = allUnitsOfClass.find((unit: any) => unit.id === unitId);
    if (!unit) {
      throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Unit not found!");
    }
    return {
      id: unit.id,
      code: unit.code,
      hour: unit.hour,
      title: unit.title,
      statusOfCompletion: UNIT_COMPETENCY_MAP.NYS.code,
      classStartDate: classData.classDetails.startDate,
      classEndDate: classData.classDetails.endDate,
      unitStartDate: new Date(),
      unitEndDate: classData.classDetails.endDate,
      unitEnrollmentDate: new Date()
    };
  });

  // 4. Add enrollment
  const prepareData: any = {
    class: {
      id: classData._id,
      title: classData.classDetails.classTitle
    },
    studentInfo: {
      id: studentData._id,
      name: `${studentData.personalInfo.givenName} ${studentData.personalInfo.surname}`,
      email: studentData.contactDetails.email,
      phone: studentData.contactDetails.personalPhone,
      USI: studentData.participantsIdentifiers.USI
    },
    unitsOfCompetency: unitsOfCompetency,
    enrollmentDate: new Date()
  };

  classData.enrollments.push(prepareData);
  await classData.save();

  sendEmail({
    to: enrollmentData.email,
    subject: "Enrollment Notice",
    templateName: "onboardToken.template",
    templateData: {
      onboardUrl: ""
    }
  });
  return classData;
};

const removeEnrollment = async (classId: string, studentId: string) => {
  const classData = await ClassModel.findById(classId);

  if (!classData) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, DATA_NOT_FOUND.message);
  }

  const enrollmentIndex = classData.enrollments.findIndex(
    (enrollment: { studentInfo: { id: string } }) => enrollment.studentInfo.id === studentId
  );

  if (enrollmentIndex === -1) {
    throw new AppError(httpStatus.NOT_FOUND, "NOT_FOUND", "Student enrollment not found in this class!");
  }

  classData.enrollments.splice(enrollmentIndex, 1);
  await classData.save();

  return classData;
};

const getEnrollmentsByClassId = async (classId: string) => {
  const classData = await ClassModel.findById(classId).select("enrollments");

  if (!classData) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, DATA_NOT_FOUND.message);
  }

  return classData.enrollments;
};

const getStudentEnrollment = async (classId: string, studentId: string) => {
  const classData = await ClassModel.findById(classId);

  if (!classData) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, DATA_NOT_FOUND.message);
  }

  const enrollment = classData.enrollments.find(
    (enr: { studentInfo: { id: string } }) => enr.studentInfo.id === studentId
  );

  if (!enrollment) {
    throw new AppError(httpStatus.NOT_FOUND, "NOT_FOUND", "Student enrollment not found in this class!");
  }

  return enrollment;
};

const updateStatusOfUnitCompletion = async (
  classId: string,
  studentId: string,
  unitId: string,
  newStatus: UnitCompetencyCode
) => {
  // Validate status code
  if (!UNIT_COMPETENCY_MAP[newStatus]) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "INVALID_STATUS",
      `Invalid status code. Must be one of: ${Object.keys(UNIT_COMPETENCY_MAP).join(", ")}`
    );
  }

  const classData = await ClassModel.findById(classId);

  if (!classData) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Class not found");
  }

  const enrollment = classData.enrollments.find(
    (enr: { studentInfo: { id: string } }) => enr.studentInfo.id === studentId
  );

  if (!enrollment) {
    throw new AppError(httpStatus.NOT_FOUND, "ENROLLMENT_NOT_FOUND", "Student enrollment not found in this class!");
  }

  const unit = enrollment.unitsOfCompetency.find((u: { id: string }) => u.id === unitId);

  if (!unit) {
    throw new AppError(httpStatus.NOT_FOUND, "UNIT_NOT_FOUND", "Unit of competency not found in this enrollment!");
  }

  const isCertificateGenerated =
    enrollment.certificateId !== null &&
    enrollment.certificateIssuedDate !== null &&
    enrollment.certificateShortId !== null;

  if (isCertificateGenerated) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "CERTIFICATE_GENERATED",
      "Certificate is already generated, cannot update units!"
    );
  }

  const oldStatus = unit.statusOfCompletion;
  unit.statusOfCompletion = newStatus;

  // If changing FROM completed TO incomplete, clear unitCompletionDate and enrollment.completionDate
  const wasCompleted = ENROLLED_UNIT_COMPLETED_STATUSES.includes(oldStatus);
  const isNowCompleted = ENROLLED_UNIT_COMPLETED_STATUSES.includes(newStatus);

  if (wasCompleted && !isNowCompleted) {
    unit.unitCompletionDate = null;
    enrollment.completionDate = null;
  }

  // Check if all units are completed
  const allUnitsCompleted = enrollment.unitsOfCompetency.every((u: { statusOfCompletion: string }) =>
    ENROLLED_UNIT_COMPLETED_STATUSES.includes(u.statusOfCompletion as UnitCompetencyCode)
  );

  if (allUnitsCompleted) {
    enrollment.completionDate = new Date();
  }

  await classData.save();

  return {
    enrollment,
    updatedUnit: unit,
    oldStatus,
    newStatus,
    statusDetails: UNIT_COMPETENCY_MAP[newStatus]
  };
};

const enrolledUnitUpdate = async (
  classId: string,
  studentId: string,
  unitId: string,
  status?: UnitCompetencyCode,
  hour?: number,
  unitStartDate?: Date,
  unitEndDate?: Date,
  unitEnrollmentDate?: Date,
  unitCompletionDate?: Date
) => {
  const classData = await ClassModel.findById(classId);
  if (!classData) {
    throw new AppError(httpStatus.NOT_FOUND, "CLASS_NOT_FOUND", "Class not found");
  }

  const enrollment = classData.enrollments.find((e: { studentInfo: { id: string } }) => e.studentInfo.id === studentId);
  if (!enrollment) {
    throw new AppError(httpStatus.NOT_FOUND, "ENROLLMENT_NOT_FOUND", "Enrollment not found");
  }

  const unit = enrollment.unitsOfCompetency.find((u: { id: string }) => u.id === unitId);
  if (!unit) {
    throw new AppError(httpStatus.NOT_FOUND, "UNIT_NOT_FOUND", "Unit not found");
  }

  const isCertificateGenerated =
    enrollment.certificateId && enrollment.certificateIssuedDate && enrollment.certificateShortId;

  if (isCertificateGenerated) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "CERTIFICATE_GENERATED",
      "Certificate already generated, cannot update units"
    );
  }

  // Guard: nothing to update
  if (
    status === undefined &&
    hour === undefined &&
    !unitStartDate &&
    !unitEndDate &&
    !unitEnrollmentDate &&
    !unitCompletionDate
  ) {
    throw new AppError(httpStatus.BAD_REQUEST, "NO_FIELDS", "No fields provided to update");
  }

  // -------- DATE VALIDATION (USING FINAL VALUES) --------
  const finalStartDate = unitStartDate ?? unit.unitStartDate;
  const finalEndDate = unitEndDate ?? unit.unitEndDate;
  const finalEnrollmentDate = unitEnrollmentDate ?? unit.unitEnrollmentDate;
  const finalCompletionDate = unitCompletionDate ?? unit.unitCompletionDate;

  if (finalStartDate && finalEndDate && new Date(finalStartDate) > new Date(finalEndDate)) {
    throw new AppError(httpStatus.BAD_REQUEST, "INVALID_DATES", "Unit start date cannot be greater than unit end date");
  }

  if (finalEnrollmentDate && finalCompletionDate && new Date(finalEnrollmentDate) > new Date(finalCompletionDate)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "INVALID_DATES",
      "Unit enrollment date cannot be greater than unit completion date"
    );
  }

  // -------- STATE TRANSITION LOGIC --------
  const oldStatus = unit.statusOfCompletion;

  // Update status FIRST
  if (status !== undefined) {
    unit.statusOfCompletion = status;
  }

  const wasCompleted = ENROLLED_UNIT_COMPLETED_STATUSES.includes(oldStatus);
  const isNowCompleted = ENROLLED_UNIT_COMPLETED_STATUSES.includes(unit.statusOfCompletion);

  // -------- UPDATE FIELDS --------
  if (hour !== undefined) {
    unit.hour = hour;
  } else if (unit.hour === undefined || unit.hour === null) {
    unit.hour = 0; // enforce schema invariant
  }

  if (unitStartDate) unit.unitStartDate = unitStartDate;
  if (unitEndDate) unit.unitEndDate = unitEndDate;
  if (unitEnrollmentDate) unit.unitEnrollmentDate = unitEnrollmentDate;

  // Completion date rules
  if (isNowCompleted) {
    if (unitCompletionDate) {
      unit.unitCompletionDate = unitCompletionDate;
    } else if (!unit.unitCompletionDate) {
      unit.unitCompletionDate = new Date();
    }
  } else {
    // HARD INVARIANT: incomplete units NEVER have completion dates
    unit.unitCompletionDate = null;
  }

  // -------- ENROLLMENT COMPLETION LOGIC --------
  if (wasCompleted && !isNowCompleted) {
    enrollment.completionDate = null;
  }

  const allCompleted = enrollment.unitsOfCompetency.every((u: { statusOfCompletion: string }) =>
    ENROLLED_UNIT_COMPLETED_STATUSES.includes(u.statusOfCompletion as UnitCompetencyCode)
  );

  if (allCompleted && !enrollment.completionDate) {
    enrollment.completionDate = new Date();
  }

  await classData.save();

  return {
    enrollmentId: enrollment,
    updatedUnitId: unit.id,
    oldStatus,
    newStatus: unit.statusOfCompletion,
    statusDetails: status !== undefined ? UNIT_COMPETENCY_MAP[status] : undefined
  };
};

const enrolledUnitsBulkUpdate = async (
  classId: string,
  studentId: string,
  unitIds: string[],
  enrollmentDate?: Date,
  status?: UnitCompetencyCode,
  hour?: number,
  unitStartDate?: Date,
  unitEndDate?: Date,
  unitEnrollmentDate?: Date,
  unitCompletionDate?: Date
) => {
  if (status && !UNIT_COMPETENCY_MAP[status]) {
    throw new AppError(httpStatus.BAD_REQUEST, "INVALID_STATUS", "Invalid unit status");
  }

  // Date validations
  if (unitStartDate && unitEndDate && new Date(unitStartDate) > new Date(unitEndDate)) {
    throw new AppError(httpStatus.BAD_REQUEST, "INVALID_DATES", "Unit start date cannot be greater than unit end date");
  }

  if (unitEnrollmentDate && unitCompletionDate && new Date(unitEnrollmentDate) > new Date(unitCompletionDate)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "INVALID_DATES",
      "Unit enrollment date cannot be greater than unit completion date"
    );
  }

  const classData = await ClassModel.findById(classId);
  if (!classData) {
    throw new AppError(httpStatus.NOT_FOUND, "CLASS_NOT_FOUND", "Class not found");
  }

  const enrollment = classData.enrollments.find((e: { studentInfo: { id: string } }) => e.studentInfo.id === studentId);
  if (!enrollment) {
    throw new AppError(httpStatus.NOT_FOUND, "ENROLLMENT_NOT_FOUND", "Enrollment not found");
  }

  const isCertificateGenerated =
    enrollment.certificateId && enrollment.certificateIssuedDate && enrollment.certificateShortId;

  if (isCertificateGenerated) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "CERTIFICATE_GENERATED",
      "Certificate already generated, cannot update units"
    );
  }

  if (
    status === undefined &&
    hour === undefined &&
    !unitStartDate &&
    !unitEndDate &&
    !enrollmentDate &&
    !unitEnrollmentDate &&
    !unitCompletionDate
  ) {
    throw new AppError(httpStatus.BAD_REQUEST, "NO_FIELDS", "No fields provided to update");
  }

  // Track if any unit changed from completed to incomplete
  let anyChangedToIncomplete = false;

  // Update units and unit completion date
  enrollment.unitsOfCompetency.forEach((unit) => {
    if (unitIds?.includes(unit.id)) {
      const wasCompleted = ENROLLED_UNIT_COMPLETED_STATUSES?.includes(unit.statusOfCompletion as UnitCompetencyCode);

      if (status) {
        unit.statusOfCompletion = status;
        const isNowCompleted = ENROLLED_UNIT_COMPLETED_STATUSES?.includes(status);
        if (wasCompleted && !isNowCompleted) {
          unit.unitCompletionDate = null;
          anyChangedToIncomplete = true;
        }
        if (isNowCompleted) {
          unit.unitCompletionDate = new Date();
        }
      }

      if (hour !== undefined) {
        unit.hour = hour;
      } else if (unit.hour === undefined || unit.hour === null) {
        // SAFETY DEFAULT (MANDATORY)
        unit.hour = 0;
      }

      if (unitStartDate) unit.unitStartDate = unitStartDate;
      if (unitEndDate) unit.unitEndDate = unitEndDate;
      if (unitEnrollmentDate) unit.unitEnrollmentDate = unitEnrollmentDate;
      if (unitCompletionDate) unit.unitCompletionDate = unitCompletionDate;
    }
  });

  // Clear enrollment completion date if any unit changed to incomplete
  if (anyChangedToIncomplete) {
    enrollment.completionDate = null;
  }

  // Check if all units are now completed
  const allCompleted = enrollment.unitsOfCompetency.every((u: { statusOfCompletion: string }) =>
    ENROLLED_UNIT_COMPLETED_STATUSES?.includes(u.statusOfCompletion as UnitCompetencyCode)
  );

  if (allCompleted && !enrollment.completionDate) {
    enrollment.completionDate = new Date();
  }

  if (enrollmentDate) enrollment.enrollmentDate = enrollmentDate;

  await classData.save();

  return {
    updatedUnits: unitIds?.length
  };
};

const unitsStatusBulkUpdate = async (
  classId: string,
  studentIds: string[],
  unitIds: string[],
  status: UnitCompetencyCode
) => {
  const classData = await ClassModel.findById(classId);

  if (!classData) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Class not found");
  }

  const enrollments = classData.enrollments.filter((enr: { studentInfo: { id: string } }) =>
    studentIds?.includes(enr.studentInfo.id)
  );

  if (enrollments.length === 0) {
    throw new AppError(httpStatus.NOT_FOUND, "ENROLLMENT_NOT_FOUND", "Student enrollments not found in this class!");
  }

  const units = enrollments.flatMap((enr: { unitsOfCompetency: any[] }) =>
    enr.unitsOfCompetency.filter((u: { id: string }) => unitIds?.includes(u.id))
  );

  if (units.length === 0) {
    throw new AppError(httpStatus.NOT_FOUND, "UNIT_NOT_FOUND", "Units of competency not found in this enrollment!");
  }

  const isCertificateGenerated = enrollments.some(
    (enr) => enr.certificateId !== null && enr.certificateIssuedDate !== null
  );

  if (isCertificateGenerated) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "CERTIFICATE_GENERATED",
      "Certificate is already generated, cannot update units!"
    );
  }

  const updatedUnits = units.map((unit: { statusOfCompletion: string; unitCompletionDate: Date }) => {
    const oldStatus = unit.statusOfCompletion;
    unit.statusOfCompletion = status;
    if (ENROLLED_UNIT_COMPLETED_STATUSES.includes(unit.statusOfCompletion as UnitCompetencyCode)) {
      unit.unitCompletionDate = new Date();
    }
    return {
      enrollment: unit,
      updatedUnit: unit,
      oldStatus,
      newStatus: status,
      statusDetails: UNIT_COMPETENCY_MAP[status]
    };
  });

  const allUnitsCompleted = enrollments.every((enr: { unitsOfCompetency: any[] }) =>
    enr.unitsOfCompetency.every((u: { statusOfCompletion: string }) =>
      ENROLLED_UNIT_COMPLETED_STATUSES.includes(u.statusOfCompletion as UnitCompetencyCode)
    )
  );

  if (allUnitsCompleted) {
    enrollments.forEach((enr) => {
      enr.completionDate = new Date();
    });
  }

  await classData.save();

  return updatedUnits;
};

const updateCourseEnrollAndCompleteDate = async (data: IUpdateCourseEnrollAndCompleteDate) => {
  const cls = await ClassModel.findById(data.classId);
  if (!cls) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      DATA_NOT_FOUND.code,
      "Class not found to update enrollment and completion date!"
    );
  }

  // check those students are actually enrolled or not
  const studentsAreEnrolled = cls.enrollments.filter((enr) =>
    data.students.some((stu) => stu.id === enr.studentInfo.id)
  );

  if (studentsAreEnrolled.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, BAD_REQUEST.code, "Students are not enrolled in this class!");
  }

  cls.enrollments = cls.enrollments.map((enr) => {
    const student = data.students.find((stu) => stu.id === enr.studentInfo.id);
    if (student) {
      enr.enrollmentDate = student.enrollmentDate;
      enr.completionDate = student.completionDate;
    }
    return enr;
  });

  await cls.save();
  return cls.enrollments;
};

export const EnrollmentServices = {
  addEnrollment,
  addEnrollmentWithNotify,
  removeEnrollment,
  getEnrollmentsByClassId,
  getStudentEnrollment,
  updateStatusOfUnitCompletion,
  enrolledUnitsBulkUpdate,
  enrolledUnitUpdate,
  unitsStatusBulkUpdate,
  updateCourseEnrollAndCompleteDate
};

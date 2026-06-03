/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";
import { StudentModel } from "../model/student.model";
import { StudentAuditModel } from "../model/student-audit.model";
import { logActivity } from "../utils/activityLogger";
import { AddStudentT, UpdateStudentT } from "../schemas/student.schema";
import { QueryBuilder } from "../utils/queryBuilder";
import { BAD_REQUEST, CONFLICT_ERROR, DATA_NOT_FOUND, httpStatus } from "../constants";
import { AppError } from "../utils/appError";
import { generateSequentialId, generateStudentId } from "../utils/sequentialIdGenerator";

const buildSortStage = (sortParam?: string) => {
  const sort = sortParam?.trim() || "-createdAt";

  return sort.split(",").reduce(
    (acc, field) => {
      const value = field.trim();
      if (!value) return acc;

      if (value.startsWith("-")) {
        acc[value.slice(1)] = -1;
      } else {
        acc[value] = 1;
      }

      return acc;
    },
    {} as Record<string, 1 | -1>
  );
};

// creating new student
const addNewStudent = async (data: AddStudentT, organizationId: string) => {
  if (!organizationId) {
    throw new AppError(httpStatus.BAD_REQUEST, BAD_REQUEST.code, "Organization ID is required");
  }

  // Generate unique student ID — format: STU-YYYYMM-NNNNNN (e.g. STU-202605-000042)
  const studentId = await generateStudentId(organizationId);

  // Generate unique student AVETMISS ID
  const avetmissId = await generateSequentialId({
    key: `avetmiss-student:${organizationId}`,
    prefix: "AS"
    // middleIndicator: "AVM"
    // pad: 8
  });

  const existingStudent = await StudentModel.findOne({
    "contactDetails.email": data?.contactDetails.email
  });
  if (existingStudent) {
    throw new AppError(httpStatus.CONFLICT, CONFLICT_ERROR.code, "Email already exists with another student");
  }

  // Catch any remaining compound key collision gracefully
  try {
    const newStudent = await StudentModel.create({ ...data, organizationId, studentId, avetmissId });
    return newStudent;
  } catch (err: any) {
    if (err?.code === 11000 && err?.keyPattern?.studentId) {
      throw new AppError(httpStatus.CONFLICT, CONFLICT_ERROR.code, "Student ID conflict, please try again");
    }
    throw err;
  }
};

// get all students with comprehensive filtering
const getAllStudents = async (query: Record<string, string>, organizationId: string) => {
  // Step 1: Build base filter with organizationId — exclude soft-deleted (R-01)
  const baseFilter: any = { organizationId, isDeleted: { $ne: true } };

  // Step 2: Build advanced filters
  const advancedFilters: any = {};

  // Personal Info Filters
  if (query.surname) {
    advancedFilters["personalInfo.surname"] = {
      $regex: query.surname.trim(),
      $options: "i"
    };
  }

  if (query.preferredName) {
    advancedFilters["personalInfo.preferredName"] = {
      $regex: query.preferredName.trim(),
      $options: "i"
    };
  }

  if (query.givenName || query.firstName) {
    const name = query.givenName || query.firstName;
    advancedFilters["personalInfo.givenName"] = {
      $regex: name.trim(),
      $options: "i"
    };
  }

  if (query.middleName) {
    const name = query.middleName;
    advancedFilters["personalInfo.middleName"] = {
      $regex: name.trim(),
      $options: "i"
    };
  }

  // Date of Birth - exact match
  if (query.dateOfBirth) {
    advancedFilters["personalInfo.dateOfBirth"] = query.dateOfBirth;
  }

  // Contact Filters
  if (query.email) {
    advancedFilters["contactDetails.email"] = {
      $regex: query.email.trim(),
      $options: "i"
    };
  }

  // Address Filters
  if (query.city) {
    advancedFilters["address.primaryPostalAddress.city"] = {
      $regex: query.city.trim(),
      $options: "i"
    };
  }

  if (query.state) {
    advancedFilters["address.primaryPostalAddress.state"] = {
      $regex: query.state.trim(),
      $options: "i"
    };
  }

  if (query.postCode) {
    advancedFilters["address.primaryPostalAddress.postCode"] = query.postCode;
  }

  if (query.country) {
    advancedFilters["address.primaryPostalAddress.country"] = {
      $regex: query.country.trim(),
      $options: "i"
    };
  }

  // Employment Details Filters
  if (query.organization) {
    advancedFilters["employmentDetails.organization"] = {
      $regex: query.organization.trim(),
      $options: "i"
    };
  }

  // Participant Identifiers
  if (query.usi) {
    advancedFilters["participantsIdentifiers.USI"] = {
      $regex: query.usi.trim(),
      $options: "i"
    };
  }

  // VET Details - Employment Status (multi-value comma separated)
  if (query.status) {
    const statuses = query.status
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length) {
      advancedFilters["vetDetails.employmentStatus"] = { $in: statuses };
    }
  }

  // Qualification Filter - Check enrollments in classes
  if (query.qualification) {
    // This requires aggregation to check enrollments
    // We'll handle this separately after the base query
  }

  // E-04: Enrollment status filter — "enrolled" | "not_enrolled" (cross-class lookup)
  if (query.enrollmentStatus === "enrolled" || query.enrollmentStatus === "not_enrolled") {
    const { ClassModel } = await import("../model/class.model");
    const enrolledClasses = await ClassModel.find({ organizationId }).select("enrollments.studentInfo.id").lean();
    const enrolledStudentIds = new Set<string>();
    for (const cls of enrolledClasses) {
      for (const enr of (cls as any).enrollments ?? []) {
        if (enr.studentInfo?.id) enrolledStudentIds.add(enr.studentInfo.id);
      }
    }
    const idArray = Array.from(enrolledStudentIds).map((id) => new Types.ObjectId(id));
    if (query.enrollmentStatus === "enrolled") {
      advancedFilters["_id"] = { $in: idArray };
    } else {
      advancedFilters["_id"] = { $nin: idArray };
    }
  }

  // Step 3: Combine base and advanced filters
  const combinedFilter = { ...baseFilter, ...advancedFilters };

  // Step 4: Create clean query without filter params
  const cleanQuery = { ...query };
  delete cleanQuery.surname;
  delete cleanQuery.preferredName;
  delete cleanQuery.givenName;
  delete cleanQuery.middleName;
  delete cleanQuery.dateOfBirth;
  delete cleanQuery.email;
  delete cleanQuery.city;
  delete cleanQuery.state;
  delete cleanQuery.postCode;
  delete cleanQuery.country;
  delete cleanQuery.organization;
  delete cleanQuery.usi;
  delete cleanQuery.status;
  delete cleanQuery.qualification;
  delete (cleanQuery as any).enrollmentStatus;

  // Step 5: Build searchable fields
  const searchableFields = [
    "personalInfo.title",
    "personalInfo.givenName",
    "personalInfo.middleName",
    "personalInfo.surname",
    "personalInfo.preferredName",
    "employmentDetails.organization",
    "employmentDetails.position",
    "employmentDetails.division",
    "employmentDetails.section",
    "contactDetails.email",
    "contactDetails.personalPhone.number",
    "contactDetails.alternateEmail",
    "contactDetails.website",
    "address.primaryPostalAddress.city",
    "address.primaryPostalAddress.state",
    "address.primaryPostalAddress.postCode",
    "address.primaryPostalAddress.country",
    "address.primaryPostalAddress.street",
    "address.primaryPostalAddress.building",
    "participantsIdentifiers.USI"
  ];

  // Step 6: Handle qualification filter with aggregation
  if (query.qualification) {
    if (!Types.ObjectId.isValid(query.qualification)) {
      return {
        students: [],
        total: 0,
        page: Number(cleanQuery.page) || 1,
        limit: Number(cleanQuery.limit) || 10,
        totalPages: 0
      };
    }

    const qualificationId = new Types.ObjectId(query.qualification);
    const organizationObjectId = new Types.ObjectId(organizationId);
    const sortStage = buildSortStage(cleanQuery.sort);
    const aggregateBaseFilter = {
      ...combinedFilter,
      organizationId: organizationObjectId
    };

    const pipeline: any[] = [
      { $match: aggregateBaseFilter },
      {
        $lookup: {
          from: "classes",
          let: {
            studentId: { $toString: "$_id" },
            studentEmail: "$contactDetails.email"
          },
          pipeline: [
            {
              $match: {
                organizationId: organizationObjectId,
                qualificationId,
                $expr: {
                  $or: [
                    {
                      $in: [
                        "$$studentId",
                        {
                          $map: {
                            input: "$enrollments",
                            as: "enrollment",
                            in: "$$enrollment.studentInfo.id"
                          }
                        }
                      ]
                    },
                    {
                      $in: [
                        "$$studentEmail",
                        {
                          $map: {
                            input: "$enrollments",
                            as: "enrollment",
                            in: "$$enrollment.studentInfo.email"
                          }
                        }
                      ]
                    }
                  ]
                }
              }
            }
          ],
          as: "enrolledClasses"
        }
      },
      { $match: { "enrolledClasses.0": { $exists: true } } }
    ];

    // Add search condition if present
    if (cleanQuery.search) {
      const searchRegex = { $regex: cleanQuery.search, $options: "i" };
      pipeline.push({
        $match: {
          $or: searchableFields.map((field) => ({ [field]: searchRegex }))
        }
      });
    }

    // Add pagination
    const page = Number(cleanQuery.page) || 1;
    const limit = Number(cleanQuery.limit) || 10;
    const skip = (page - 1) * limit;

    pipeline.push({ $sort: sortStage }, { $skip: skip }, { $limit: limit });

    const students = await StudentModel.aggregate(pipeline);
    const total = await StudentModel.aggregate([...pipeline.slice(0, -3), { $count: "total" }]);

    const totalCount = total[0]?.total || 0;

    return {
      students,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  }

  // Step 7: Regular query without qualification filter
  const baseQuery = StudentModel.find(combinedFilter);
  const queryBuilder = new QueryBuilder(baseQuery, cleanQuery);

  const students = await queryBuilder.search(searchableFields).filter().sort().select().pagination().build();

  const meta = await queryBuilder.getMeta();

  return { students, ...meta };
};

// get a single student via Id
const getStudentById = async (studentId: string) => {
  const student = await StudentModel.findById(studentId);
  if (!student || student.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, DATA_NOT_FOUND.message);
  }
  return student;
};

// helper function => to update a student data smoothly
export function flattenUpdate(obj: any, prefix = ""): Record<string, any> {
  const flattened: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;

    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && value.constructor === Object) {
      Object.assign(flattened, flattenUpdate(value, newKey));
    } else {
      flattened[newKey] = value;
    }
  }
  return flattened;
}

// update a student data
const updateStudent = async (studentId: string, data: UpdateStudentT) => {
  if (!Types.ObjectId.isValid(studentId)) {
    throw new AppError(httpStatus.BAD_REQUEST, BAD_REQUEST.code, BAD_REQUEST.message);
  }

  if (data.contactDetails?.email) {
    const existingStudent = await StudentModel.findOne({
      "contactDetails.email": data.contactDetails.email,
      _id: { $ne: studentId }
    });

    if (existingStudent) {
      throw new AppError(httpStatus.CONFLICT, CONFLICT_ERROR.code, "Another student already exists with this email");
    }
  }

  const student = await StudentModel.findByIdAndUpdate(
    studentId,
    { $set: flattenUpdate(data) },
    {
      new: true,
      runValidators: false
    }
  );

  if (!student) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, DATA_NOT_FOUND.message);
  }

  return student;
};

// Soft-delete a student — keeps the record for ASQA/AVETMISS reports (R-01)
const deleteStudent = async (studentId: string, actorUserId?: string) => {
  const student = await StudentModel.findByIdAndUpdate(
    studentId,
    { $set: { isDeleted: true, deletedAt: new Date() } },
    { new: true }
  );
  if (!student) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Student not found");
  }

  await StudentAuditModel.create({
    organizationId: student.organizationId,
    studentId: student.studentId,
    studentObjectId: student._id,
    action: "deleted",
    studentSnapshot: {
      givenName: student.personalInfo?.givenName,
      surname: student.personalInfo?.surname,
      email: student.contactDetails?.email,
      studentId: student.studentId
    },
    actorUserId: actorUserId ? new Types.ObjectId(actorUserId) : undefined
  });

  logActivity({
    organizationId: String(student.organizationId),
    actorUserId,
    entityType: "student",
    entityId: String(student._id),
    entityLabel: `${student.personalInfo?.givenName ?? ""} ${student.personalInfo?.surname ?? ""}`.trim(),
    action: "delete"
  });
};

// Get unique values for filter dropdowns — exclude soft-deleted (R-01)
const activeFilter = (organizationId: string) => ({ organizationId, isDeleted: { $ne: true } });

const getUniqueLocations = async (organizationId: string) => {
  const cities = await StudentModel.distinct("address.primaryPostalAddress.city", activeFilter(organizationId));
  return cities.filter(Boolean).sort();
};

const getUniqueStates = async (organizationId: string) => {
  const states = await StudentModel.distinct("address.primaryPostalAddress.state", activeFilter(organizationId));
  return states.filter(Boolean).sort();
};

const getUniqueCountries = async (organizationId: string) => {
  const countries = await StudentModel.distinct("address.primaryPostalAddress.country", activeFilter(organizationId));
  return countries.filter(Boolean).sort();
};

const getDeletedStudents = async (organizationId: string) => {
  return StudentModel.find({ organizationId, isDeleted: true })
    .select("personalInfo contactDetails studentId deletedAt")
    .sort({ deletedAt: -1 })
    .lean();
};

const restoreStudent = async (studentId: string, organizationId: string) => {
  const student = await StudentModel.findOneAndUpdate(
    { _id: studentId, organizationId, isDeleted: true },
    { $set: { isDeleted: false }, $unset: { deletedAt: "" } },
    { new: true }
  );
  if (!student) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Deleted student not found");
  }

  logActivity({
    organizationId,
    entityType: "student",
    entityId: String(student._id),
    entityLabel: `${student.personalInfo?.givenName ?? ""} ${student.personalInfo?.surname ?? ""}`.trim(),
    action: "restore"
  });

  return student;
};

export const StudentServices = {
  addNewStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  getDeletedStudents,
  restoreStudent,
  getUniqueLocations,
  getUniqueStates,
  getUniqueCountries
};

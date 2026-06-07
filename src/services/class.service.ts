/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Types } from "mongoose";
import { CONFLICT_ERROR, DATA_NOT_FOUND, httpStatus, UNIT_COMPETENCY_MAP } from "../constants";
import { ClassModel } from "../model/class.model";
import { AddClassT, DeleteUnitsFromClassEnrollmentT } from "../schemas/class.schema";
import { AppError } from "../utils/appError";
import { QueryBuilder } from "../utils/queryBuilder";
import { StudentModel } from "../model/student.model";
import { logActivity } from "../utils/activityLogger";

// Status meaning "no work done yet" — only such units are safe to drop when a
// unit is removed from a class that already has enrolled students.
const NOT_STARTED_STATUS = UNIT_COMPETENCY_MAP.NYS.code;

export interface EnrollmentSyncSummary {
  syncedStudents: number;
  skippedCertified: number;
  addedUnitCodes: string[];
  removedUnitCodes: string[];
  // Units that were dropped from the class but kept on a student because they
  // already had a result/progress (would otherwise lose reportable AVETMISS data).
  protectedUnits: { studentName: string; units: string[] }[];
}

/**
 * Reconcile every enrolled student's unit snapshot against the class's new unit
 * list. Students with an issued certificate are frozen. For everyone else:
 *  - units newly added to the class are appended (status "Not yet started")
 *  - units still present are left untouched (preserves their progress/result)
 *  - units removed from the class are dropped ONLY if the student hasn't started
 *    them; units with any progress are protected (kept) and reported back.
 */
const syncEnrollmentUnits = (classDoc: any): EnrollmentSyncSummary => {
  const allNewUnits = [
    ...(classDoc.unitsInfo?.selectedUnits?.core ?? []),
    ...(classDoc.unitsInfo?.selectedUnits?.elective ?? [])
  ];
  const newUnitIds = new Set(allNewUnits.map((u: any) => String(u.id)));

  const summary: EnrollmentSyncSummary = {
    syncedStudents: 0,
    skippedCertified: 0,
    addedUnitCodes: [],
    removedUnitCodes: [],
    protectedUnits: []
  };
  const addedCodes = new Set<string>();
  const removedCodes = new Set<string>();

  for (const enr of classDoc.enrollments ?? []) {
    const hasCertificate =
      enr.certificateId !== null && enr.certificateIssuedDate !== null && enr.certificateShortId !== null;
    if (hasCertificate) {
      summary.skippedCertified += 1;
      continue;
    }

    const currentById = new Map((enr.unitsOfCompetency ?? []).map((u: any) => [String(u.id), u]));
    const nextUnits: any[] = [];
    let changed = false;

    // Keep or add each unit that belongs to the class now.
    for (const u of allNewUnits) {
      const existing = currentById.get(String(u.id));
      if (existing) {
        nextUnits.push(existing);
      } else {
        nextUnits.push({
          id: u.id,
          code: u.code,
          hour: u.hour,
          title: u.title,
          statusOfCompletion: NOT_STARTED_STATUS,
          classStartDate: classDoc.classDetails.startDate,
          classEndDate: classDoc.classDetails.endDate,
          unitStartDate: new Date(),
          unitEndDate: classDoc.classDetails.endDate,
          unitEnrollmentDate: new Date()
        });
        addedCodes.add(u.code);
        changed = true;
      }
    }

    // Units the student has that are no longer on the class.
    const protectedForStudent: string[] = [];
    for (const eu of enr.unitsOfCompetency ?? []) {
      if (newUnitIds.has(String(eu.id))) continue;
      if (eu.statusOfCompletion === NOT_STARTED_STATUS) {
        removedCodes.add(eu.code);
        changed = true;
      } else {
        nextUnits.push(eu);
        protectedForStudent.push(eu.code);
      }
    }

    enr.unitsOfCompetency = nextUnits;
    if (protectedForStudent.length) {
      summary.protectedUnits.push({ studentName: enr.studentInfo?.name ?? "Student", units: protectedForStudent });
    }
    if (changed || protectedForStudent.length) summary.syncedStudents += 1;
  }

  summary.addedUnitCodes = [...addedCodes];
  summary.removedUnitCodes = [...removedCodes];
  return summary;
};

const addClass = async (classData: AddClassT, organizationId: string) => {
  const existingClass = await ClassModel.findOne({
    "classDetails.classTitle": classData.classDetails.classTitle
  });
  if (existingClass) {
    throw new AppError(httpStatus.CONFLICT, CONFLICT_ERROR.code, CONFLICT_ERROR.message);
  }
  const newClass = await ClassModel.create({ ...classData, organizationId });
  return newClass;
};

const getAllClasses = async (query: Record<string, string>, organizationId: string) => {
  // Step 1: Build base filter with ONLY organizationId
  const baseFilter: any = { organizationId };

  // Step 2: Build advanced filters separately
  const advancedFilters: any = {};

  // Qualification filter - exact match by ID
  if (query.qualification) {
    advancedFilters["qualification._id"] = query.qualification;
  }

  // Trainer filter - exact match by ID
  if (query.trainer) {
    advancedFilters["classDetails.defaultTrainer"] = query.trainer;
  }

  // Location filter - case-insensitive regex
  if (query.location) {
    advancedFilters["classDetails.location"] = {
      $regex: query.location.trim(),
      $options: "i"
    };
  }

  // Date range filter - proper overlap logic
  if (query.startDate || query.endDate) {
    const dateConditions: any[] = [];

    if (query.startDate) {
      // Class end date must be >= filter start date (class hasn't ended before filter starts)
      dateConditions.push({
        "classDetails.endDate": { $gte: new Date(query.startDate) }
      });
    }

    if (query.endDate) {
      // Class start date must be <= filter end date (class hasn't started after filter ends)
      dateConditions.push({
        "classDetails.startDate": { $lte: new Date(query.endDate) }
      });
    }

    // Combine date conditions with $and
    if (dateConditions.length > 0) {
      advancedFilters.$and = dateConditions;
    }
  }

  // Step 3: Combine base and advanced filters
  const combinedFilter = { ...baseFilter, ...advancedFilters };

  // Step 4: Create a clean query object WITHOUT filter params for QueryBuilder
  const cleanQuery = { ...query };
  delete cleanQuery.qualification;
  delete cleanQuery.trainer;
  delete cleanQuery.location;
  delete cleanQuery.startDate;
  delete cleanQuery.endDate;

  // Step 5: Initialize QueryBuilder with combined filter and clean query
  const queryBuilder = new QueryBuilder(
    ClassModel.find(combinedFilter),
    cleanQuery // ← Pass ONLY search, sort, page, limit
  );

  const searchableFields = [
    "qualification.code",
    "qualification.title",
    "classDetails.classTitle",
    "classDetails.location",
    "defaultTrainer.employeeId",
    "defaultTrainer.personalInfo.givenName",
    "defaultTrainer.personalInfo.middleName",
    "defaultTrainer.personalInfo.surname",
    "defaultTrainer.personalInfo.preferredName",
    "defaultTrainer.personalInfo.email",
    "defaultTrainer.personalInfo.phone"
  ];

  const classes = await queryBuilder
    .search(searchableFields)
    .filter() // ← This now only processes remaining params
    .sort()
    .select()
    .pagination()
    .build()
    .populate("classDetails.defaultTrainer")
    .populate("classDetails.additionalTrainers")
    .populate("classDetails.location")
    .populate("classDetails.additionalLocations")
    .populate("qualificationId")
    .populate("organizationId");

  const meta = await queryBuilder.getMeta();

  return {
    classes,
    ...meta
  };
};

const getClassById = async (classId: string) => {
  const classData = await ClassModel.findById(classId)
    .populate({
      path: "classDetails.defaultTrainer",
      model: "Trainer"
    })
    .populate({
      path: "classDetails.additionalTrainers",
      model: "Trainer"
    })
    .populate({
      path: "classDetails.location",
      model: "Location"
    })
    .populate({
      path: "qualificationId",
      model: "Qualification"
    });
  if (!classData) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, DATA_NOT_FOUND.message);
  }

  // Enrich enrollments with per-student doNotReportAvetmiss flag
  if (classData.enrollments && classData.enrollments.length > 0) {
    const studentIds = classData.enrollments.map((e) => e.studentInfo.id).filter(Boolean);
    const students = await StudentModel.find({ _id: { $in: studentIds } })
      .select("_id doNotReportAvetmiss")
      .lean();
    const doNotReportMap = new Map(students.map((s) => [s._id.toString(), s.doNotReportAvetmiss ?? false]));

    const classObj = classData.toObject();
    classObj.enrollments = classObj.enrollments.map((e: any) => ({
      ...e,
      studentInfo: {
        ...e.studentInfo,
        doNotReportAvetmiss: doNotReportMap.get(e.studentInfo.id?.toString()) ?? false
      }
    }));
    return classObj;
  }

  return classData;
};

const updateClass = async (classId: string, data: any, organizationId: string) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const existingClass = await ClassModel.findOne({
      _id: classId,
      organizationId
    }).session(session);

    if (!existingClass) {
      throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "We couldn't find this class.");
    }

    const hadEnrollments = existingClass.enrollments.length > 0;

    // Full edit is allowed even when students are enrolled. Completed/certified
    // students stay protected because their unit snapshot is reconciled, not wiped
    // (see syncEnrollmentUnits).
    if (data.classDetails) existingClass.classDetails = data.classDetails;
    if (data.reportingDetails) existingClass.reportingDetails = data.reportingDetails;
    if (data.fundDetails) existingClass.fundDetails = data.fundDetails;
    if (data.qualificationId) existingClass.qualificationId = data.qualificationId;
    if (data.deliveryLocationId) existingClass.deliveryLocationId = data.deliveryLocationId;
    if (data.unitsInfo) existingClass.unitsInfo = data.unitsInfo;

    let syncSummary: EnrollmentSyncSummary | null = null;

    if (hadEnrollments) {
      // Keep the denormalised title copied onto each enrolment in sync with the class title.
      const newTitle = data.classDetails?.classTitle;
      if (newTitle) {
        existingClass.enrollments.forEach((e: any) => {
          e.class.title = newTitle;
        });
      }
      // Reconcile each enrolled student's unit snapshot with the new unit list.
      if (data.unitsInfo) {
        syncSummary = syncEnrollmentUnits(existingClass);
      }
    } else if (data.enrollments) {
      existingClass.enrollments = data.enrollments;
    }

    await existingClass.save({ session });
    await session.commitTransaction();

    return { ...existingClass.toObject(), syncSummary };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// const deleteUnitsFromClassEnrollment = async (data: DeleteUnitsFromClassEnrollmentT) => {
//   const updatedClass = await ClassModel.findOneAndUpdate(
//     { _id: data.classId },
//     {
//       $pull: {
//         "enrollments.$[enrollment].unitsOfCompetency": {
//           id: { $in: data.unitIds }
//         }
//       }
//     },
//     {
//       arrayFilters: [
//         {
//           "enrollment.studentInfo.id": { $in: data.studentIds }
//         }
//       ],
//       new: true
//     }
//   );

//   if (!updatedClass) {
//     throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Class not found to delete units from enrollment");
//   }

//   return updatedClass;
// };

const deleteUnitsFromClassEnrollment = async (data: DeleteUnitsFromClassEnrollmentT) => {
  const updatedClass = await ClassModel.findOneAndUpdate(
    { _id: data.classId },
    {
      $pull: {
        "enrollments.$[enrollment].unitsOfCompetency": {
          id: { $in: data.unitIds }
        }
      }
    },
    {
      arrayFilters: [
        {
          "enrollment.studentInfo.id": { $in: data.studentIds },
          "enrollment.completionDate": { $ne: null },
          "enrollment.certificateId": null,
          "enrollment.certificateIssuedDate": null
        }
      ],
      new: true
    }
  );

  if (!updatedClass) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Class not found to delete units from enrollment");
  }

  return updatedClass;
};

const deleteClass = async (classId: string, actorUserId?: string) => {
  const cls = await ClassModel.findByIdAndDelete(classId);
  if (!cls) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, DATA_NOT_FOUND.message);
  }

  logActivity({
    organizationId: String(cls.organizationId),
    actorUserId,
    entityType: "class",
    entityId: String(cls._id),
    entityLabel: cls.classDetails?.classTitle ?? String(cls._id),
    action: "delete",
    before: cls.toObject() as unknown as Record<string, unknown>,
    undoable: true
  });
};

const getCertificateGeneratedClasses = async (query: Record<string, string>, organizationId: string) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const search = query.search?.trim();

  const baseMatch = {
    // organizationId,
    organizationId: new Types.ObjectId(organizationId),
    enrollments: {
      $elemMatch: {
        certificateIssuedDate: { $ne: null },
        certificateId: { $ne: null },
        certificateShortId: { $ne: null },
        certificateKey: { $ne: null }
      }
    }
  };

  const result = await ClassModel.aggregate([
    { $match: baseMatch },
    {
      $lookup: {
        from: "qualifications",
        let: { qid: "$qualificationId" },
        pipeline: [
          {
            $match: {
              // $expr: { $eq: ["$_id", { $toObjectId: "$$qid" }] }
              $expr: { $eq: ["$_id", "$$qid"] }
            }
          },
          { $project: { code: 1, title: 1 } }
        ],
        as: "qualificationId"
      }
    },
    { $unwind: "$qualificationId" },

    ...(search
      ? [
          {
            $match: {
              $or: [
                { "classDetails.classTitle": { $regex: search, $options: "i" } },
                { "qualificationId.code": { $regex: search, $options: "i" } },
                { "qualificationId.title": { $regex: search, $options: "i" } }
                // { "classDetails.location": { $regex: search, $options: "i" } }
              ]
            }
          }
        ]
      : []),

    {
      $addFields: {
        numberOfEnrolledStudents: { $size: "$enrollments" },

        numberOfIssuedCertificate: {
          $size: {
            $filter: {
              input: "$enrollments",
              as: "e",
              cond: {
                $and: [
                  { $ne: ["$$e.certificateIssuedDate", null] },
                  { $ne: ["$$e.certificateId", null] },
                  { $ne: ["$$e.certificateShortId", null] },
                  { $ne: ["$$e.certificateKey", null] }
                ]
              }
            }
          }
        }
      }
    },

    {
      $project: {
        enrollments: 0,
        reportingDetails: 0,
        fundDetails: 0,
        unitsInfo: 0,

        "qualificationId.organizationId": 0,
        "qualificationId.status": 0,
        "qualificationId.stream": 0,
        "qualificationId.latestReleaseInfo": 0,
        "qualificationId.createdAt": 0,
        "qualificationId.updatedAt": 0
      }
    },

    { $sort: { createdAt: -1 } },

    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        meta: [{ $count: "total" }]
      }
    }
  ]);

  const classes = result[0]?.data || [];
  const total = result[0]?.meta[0]?.total || 0;

  return {
    classes,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};

const getStudentEnrolledClasses = async (studentId: string, query: Record<string, string>) => {
  // check that is student actually exists
  const student = await StudentModel.findById(studentId);
  if (!student) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Student not found");
  }

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const pipeline: any[] = [
    // Match classes where the student is enrolled
    {
      $match: {
        "enrollments.studentInfo.id": studentId
      }
    },

    {
      $addFields: {
        qualificationIdObj: { $toObjectId: "$qualificationId" }
      }
    },
    {
      $lookup: {
        from: "qualifications",
        localField: "qualificationIdObj",
        foreignField: "_id",
        as: "qualification"
      }
    },
    {
      $unwind: {
        path: "$qualification",
        preserveNullAndEmptyArrays: true
      }
    },

    // Extract ONLY this student's enrollment
    {
      $addFields: {
        studentEnrollment: {
          $first: {
            $filter: {
              input: "$enrollments",
              as: "enrollment",
              cond: {
                $eq: ["$$enrollment.studentInfo.id", studentId]
              }
            }
          }
        }
      }
    },

    // Sort (decide what "recent" means)
    // Here: enrollment date
    {
      $sort: {
        "studentEnrollment.enrollmentDate": -1
      }
    },

    // Pagination + total count (single query)
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 0,

              class: {
                id: "$_id",
                title: "$classDetails.classTitle",
                location: "$classDetails.location",
                startDate: "$classDetails.startDate",
                endDate: "$classDetails.endDate"
              },

              qualification: {
                id: "$qualification._id",
                code: "$qualification.code",
                title: "$qualification.title"
              },

              enrollment: {
                enrollmentDate: "$studentEnrollment.enrollmentDate",
                completionDate: "$studentEnrollment.completionDate",
                certificateIssuedDate: "$studentEnrollment.certificateIssuedDate",
                certificateShortId: "$studentEnrollment.certificateShortId",
                certificateKey: "$studentEnrollment.certificateKey",
                unitsCount: { $size: "$studentEnrollment.unitsOfCompetency" }
              }
            }
          }
        ],
        meta: [{ $count: "total" }]
      }
    }
  ];

  const result = await ClassModel.aggregate(pipeline);

  const data = result[0]?.data || [];
  const total = result[0]?.meta[0]?.total || 0;

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

// Get unique locations for filter dropdown
const getUniqueLocations = async (organizationId: string) => {
  const locations = await ClassModel.distinct("classDetails.location", {
    organizationId
  });
  return locations.filter(Boolean).sort();
};

// Get unique trainers for filter dropdown
const getUniqueTrainers = async (organizationId: string) => {
  const classes = await ClassModel.find({ organizationId })
    .select("classDetails.defaultTrainer classDetails.additionalTrainers")
    .populate({
      path: "classDetails.defaultTrainer",
      select: "personalInfo.givenName personalInfo.surname"
    })
    .populate({
      path: "classDetails.additionalTrainers",
      select: "personalInfo.givenName personalInfo.surname"
    });

  const trainerMap = new Map();

  classes.forEach((cls) => {
    if (cls.classDetails.defaultTrainer) {
      const trainer = cls.classDetails.defaultTrainer as any;
      trainerMap.set(trainer._id.toString(), trainer);
    }
    cls.classDetails.additionalTrainers?.forEach((trainer: any) => {
      trainerMap.set(trainer._id.toString(), trainer);
    });
  });

  return Array.from(trainerMap.values());
};

export const ClassServices = {
  addClass,
  getAllClasses,
  getClassById,
  updateClass,
  deleteUnitsFromClassEnrollment,
  deleteClass,
  getCertificateGeneratedClasses,
  getStudentEnrolledClasses,
  getUniqueLocations,
  getUniqueTrainers
};

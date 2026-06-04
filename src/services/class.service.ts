/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Types } from "mongoose";
import { CONFLICT_ERROR, DATA_NOT_FOUND, httpStatus } from "../constants";
import { ClassModel } from "../model/class.model";
import { AddClassT, DeleteUnitsFromClassEnrollmentT } from "../schemas/class.schema";
import { AppError } from "../utils/appError";
import { QueryBuilder } from "../utils/queryBuilder";
import { StudentModel } from "../model/student.model";

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
      throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, DATA_NOT_FOUND.message);
    }

    // A class with enrolments may only have non-structural fields edited. Qualification, units and the
    // enrolments themselves stay locked so enrolment↔unit data (and AVETMISS NAT00120) can't desync.
    if (existingClass.enrollments.length > 0) {
      const setFields: Record<string, any> = {};
      if (data.classDetails) setFields.classDetails = data.classDetails;
      if (data.reportingDetails) setFields.reportingDetails = data.reportingDetails;
      if (data.fundDetails) setFields.fundDetails = data.fundDetails;

      // Keep the denormalised title copied onto each enrolment in sync with the class title
      const newTitle = data.classDetails?.classTitle;
      if (newTitle && newTitle !== existingClass.classDetails?.classTitle) {
        setFields["enrollments.$[].class.title"] = newTitle;
      }

      const scopedUpdate = await ClassModel.findByIdAndUpdate(
        classId,
        { $set: setFields },
        { new: true, session, runValidators: true }
      );

      await session.commitTransaction();
      return scopedUpdate;
    }

    const updatedClass = await ClassModel.findByIdAndUpdate(
      classId,
      {
        $set: {
          qualification: data.qualification,
          unitsInfo: data.unitsInfo,
          classDetails: data.classDetails,
          reportingDetails: data.reportingDetails,
          fundDetails: data.fundDetails,
          ...(data.enrollments && { enrollments: data.enrollments })
        }
      },
      { new: true, session, runValidators: true }
    );

    await session.commitTransaction();
    return updatedClass;
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

const deleteClass = async (classId: string) => {
  const cls = await ClassModel.findByIdAndDelete(classId);
  if (!cls) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, DATA_NOT_FOUND.message);
  }
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

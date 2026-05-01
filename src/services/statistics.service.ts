import { ClassModel } from "../model/class.model";
import { StudentModel } from "../model/student.model";
import { Types } from "mongoose";
import { AppError } from "../utils/appError";
import { httpStatus, monthNames } from "../constants";
import { logger } from "../utils";
import { QualificationModel } from "../model/qualification.model";
import { TrainerModel } from "../model/trainer.model";

interface DashboardStats {
  totalStudents: number;
  currentlyEnrolled: number;
  totalCertificates: number;
  pendingCertificates: number;
  activeClasses: number;
  completionRate: number;
  monthlyEnrollmentTrend: MonthlyEnrollment[];
  classPopularityAndCompletion: ClassPopularity[];
  overallCompletionRate: CompletionRatePie;
}

interface MonthlyEnrollment {
  month: string;
  year: number;
  count: number;
}

interface ClassPopularity {
  // classId: string;
  classId: Types.ObjectId;
  classTitle: string;
  qualificationTitle: string;
  completed: number;
  inProgress: number;
  total: number;
}

interface CompletionRatePie {
  completed: number;
  inProgress: number;
  dropped: number;
  completedPercentage: number;
  inProgressPercentage: number;
  droppedPercentage: number;
}

const dashboardStatistics = async (organizationId: string): Promise<DashboardStats> => {
  // Validate organization ID
  if (!organizationId || !Types.ObjectId.isValid(organizationId)) {
    throw new Error("Invalid organization ID");
  }

  const now = new Date();

  try {
    // Run all queries in parallel for better performance
    const [
      totalStudents,
      currentlyEnrolledResult,
      totalCertificatesResult,
      pendingCertificatesResult,
      activeClassesResult,
      monthlyEnrollmentTrendResult,
      classPopularityResult,
      overallCompletionRateResult
    ] = await Promise.all([
      // 1. Total Students
      StudentModel.countDocuments({ organizationId }),

      // 2. Currently Enrolled Students (unique students with active enrollments)
      ClassModel.aggregate([
        { $match: { organizationId } },
        { $unwind: "$enrollments" },
        {
          $match: {
            "enrollments.completionDate": null,
            "classDetails.endDate": { $gte: now }
          }
        },
        {
          $group: {
            _id: "$enrollments.studentInfo.id"
          }
        },
        { $count: "count" }
      ]),

      // 3. Total Certificates (enrollments with certificateIssuedDate not null)
      ClassModel.aggregate([
        { $match: { organizationId } },
        { $unwind: "$enrollments" },
        {
          $match: {
            "enrollments.certificateIssuedDate": { $ne: null }
          }
        },
        { $count: "count" }
      ]),

      // 4. Pending Certificates (completionDate not null, certificateIssuedDate null)
      ClassModel.aggregate([
        { $match: { organizationId } },
        { $unwind: "$enrollments" },
        {
          $match: {
            "enrollments.completionDate": { $ne: null },
            "enrollments.certificateIssuedDate": null
          }
        },
        { $count: "count" }
      ]),

      // 5. Active Classes (startDate <= now <= endDate)
      ClassModel.countDocuments({
        organizationId,
        "classDetails.startDate": { $lte: now },
        "classDetails.endDate": { $gte: now }
      }),

      // 6. Monthly Enrollment Trend (last 12 calendar months)
      getMonthlyEnrollmentTrend(organizationId),

      // 7. Class Popularity & Completion Rates (Top 12 classes)
      getClassPopularityAndCompletion(organizationId),

      // 8. Overall Completion Rate (based on unit competency status)
      getOverallCompletionRate(organizationId)
    ]);

    // Process results with safe fallbacks
    const currentlyEnrolled = currentlyEnrolledResult[0]?.count ?? 0;
    const totalCertificates = totalCertificatesResult[0]?.count ?? 0;
    const pendingCertificates = pendingCertificatesResult[0]?.count ?? 0;
    const activeClasses = activeClassesResult ?? 0;

    // Calculate completion rate percentage
    const completionRate = overallCompletionRateResult.completedPercentage;

    return {
      totalStudents,
      currentlyEnrolled,
      totalCertificates,
      pendingCertificates,
      activeClasses,
      completionRate,
      monthlyEnrollmentTrend: monthlyEnrollmentTrendResult,
      classPopularityAndCompletion: classPopularityResult,
      overallCompletionRate: overallCompletionRateResult
    };
  } catch (error) {
    logger.error("Dashboard statistics retrieval error: ", error);
    throw new AppError(httpStatus.BAD_REQUEST, "DASHBOARD_STATISTICS_ERROR", "Failed to retrieve dashboard statistics");
  }
};

// Get monthly enrollment trend for the last 12 calendar months
const getMonthlyEnrollmentTrend = async (organizationId: string): Promise<MonthlyEnrollment[]> => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // Calculate start date (12 months ago from current month)
  let startYear = currentYear;
  let startMonth = currentMonth - 11;
  if (startMonth <= 0) {
    startMonth += 12;
    startYear -= 1;
  }

  const startDate = new Date(startYear, startMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

  const result = await ClassModel.aggregate([
    { $match: { organizationId } },
    { $unwind: "$enrollments" },
    {
      $match: {
        "enrollments.enrollmentDate": {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$enrollments.enrollmentDate" },
          month: { $month: "$enrollments.enrollmentDate" }
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 }
    }
  ]);

  // Create a map of existing data
  const dataMap = new Map<string, number>();
  result.forEach((item) => {
    const key = `${item._id.year}-${item._id.month}`;
    dataMap.set(key, item.count);
  });

  // Generate all 12 months with 0 for missing months
  const trends: MonthlyEnrollment[] = [];
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < 12; i++) {
    let year = startYear;
    let month = startMonth + i;
    if (month > 12) {
      month -= 12;
      year += 1;
    }
    const key = `${year}-${month}`;
    trends.push({
      month: monthNames[month - 1],
      year,
      count: dataMap.get(key) ?? 0
    });
  }

  return trends;
};

// Get top 12 classes by enrollment count with completion breakdown
const getClassPopularityAndCompletion = async (organizationId: string): Promise<ClassPopularity[]> => {
  const result = await ClassModel.aggregate([
    { $match: { organizationId } },
    {
      $addFields: {
        enrollmentCount: { $size: { $ifNull: ["$enrollments", []] } }
      }
    },
    {
      $match: {
        enrollmentCount: { $gt: 0 }
      }
    },
    { $unwind: "$enrollments" },
    {
      $group: {
        _id: "$_id",
        classTitle: { $first: "$classDetails.classTitle" },
        qualificationTitle: { $first: "$qualification.title" },
        completed: {
          $sum: {
            $cond: [{ $ne: ["$enrollments.completionDate", null] }, 1, 0]
          }
        },
        inProgress: {
          $sum: {
            $cond: [{ $eq: ["$enrollments.completionDate", null] }, 1, 0]
          }
        },
        total: { $sum: 1 }
      }
    },
    {
      $sort: { total: -1 }
    },
    {
      $limit: 12
    },
    {
      $project: {
        // classId: { $toString: "$_id" },
        classId: "$_id",
        classTitle: 1,
        qualificationTitle: 1,
        completed: 1,
        inProgress: 1,
        total: 1,
        _id: 0
      }
    }
  ]);

  return result;
};

// Get overall completion rate based on unit competency status
// Only counts: C (Completed), CA (In Progress), CNA (Dropped)
const getOverallCompletionRate = async (organizationId: string): Promise<CompletionRatePie> => {
  const result = await ClassModel.aggregate([
    { $match: { organizationId } },
    { $unwind: "$enrollments" },
    { $unwind: "$enrollments.unitsOfCompetency" },
    {
      $group: {
        _id: null,
        completed: {
          $sum: {
            $cond: [{ $in: ["$enrollments.unitsOfCompetency.statusOfCompletion", ["C", "CT", "RPL-G"]] }, 1, 0]
          }
        },
        inProgress: {
          $sum: {
            $cond: [{ $eq: ["$enrollments.unitsOfCompetency.statusOfCompletion", "CA"] }, 1, 0]
          }
        },
        dropped: {
          $sum: {
            $cond: [{ $eq: ["$enrollments.unitsOfCompetency.statusOfCompletion", "CNA"] }, 1, 0]
          }
        },
        total: { $sum: 1 }
      }
    }
  ]);

  if (!result || result.length === 0) {
    return {
      completed: 0,
      inProgress: 0,
      dropped: 0,
      completedPercentage: 0,
      inProgressPercentage: 0,
      droppedPercentage: 0
    };
  }

  const data = result[0];
  const total = data.total || 1;

  return {
    completed: data.completed,
    inProgress: data.inProgress,
    dropped: data.dropped,
    completedPercentage: Math.round((data.completed / total) * 100),
    inProgressPercentage: Math.round((data.inProgress / total) * 100),
    droppedPercentage: Math.round((data.dropped / total) * 100)
  };
};

// // students statistics
interface StudentStats {
  totalStudents: number;
  joinedThisYear: number;
  lastMonthEnrolled: number;
  usiVerifiedCount: number;
}

const studentStatistics = async (organizationId: string): Promise<StudentStats> => {
  // Validate organization ID
  if (!organizationId || !Types.ObjectId.isValid(organizationId)) {
    throw new Error("Invalid organization ID");
  }

  const now = new Date();
  const currentYear = now.getFullYear();

  // Calculate last month (if current month is January, last month is December of previous year)
  const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const lastMonthYear = now.getMonth() === 0 ? currentYear - 1 : currentYear;

  // Start and end dates for current year (for student creation)
  const yearStartDate = new Date(currentYear, 0, 1, 0, 0, 0, 0); // Jan 1, current year
  const yearEndDate = new Date(currentYear, 11, 31, 23, 59, 59, 999); // Dec 31, current year

  // Start and end dates for last month (for enrollments)
  const lastMonthStartDate = new Date(lastMonthYear, lastMonth, 1, 0, 0, 0, 0);
  const lastMonthEndDate = new Date(lastMonthYear, lastMonth + 1, 0, 23, 59, 59, 999);

  try {
    // Run all queries in parallel for better performance
    const [totalStudents, joinedThisYear, lastMonthEnrolledResult, usiVerifiedCount] = await Promise.all([
      // 1. Total Students in organization
      StudentModel.countDocuments({ organizationId }),

      // 2. Students created (joined) this year - based on createdAt
      StudentModel.countDocuments({
        organizationId,
        createdAt: {
          $gte: yearStartDate,
          $lte: yearEndDate
        }
      }),

      // 3. Total enrollments in last month (not unique students, count all enrollments)
      ClassModel.aggregate([
        { $match: { organizationId } },
        { $unwind: "$enrollments" },
        {
          $match: {
            "enrollments.enrollmentDate": {
              $gte: lastMonthStartDate,
              $lte: lastMonthEndDate
            }
          }
        },
        { $count: "count" }
      ]),

      // // 4. USI verified students
      StudentModel.countDocuments({
        organizationId,
        "participantsIdentifiers.USI": { $exists: true, $ne: "" },
        "participantsIdentifiers.isUSIVerified": true,
        "participantsIdentifiers.verifiedUsiInfo.usiStatus": "Active"
        // "participantsIdentifiers.verifiedUsiInfo.firstNameMatch": true,
        // "participantsIdentifiers.verifiedUsiInfo.familyNameMatch": true,
        // "participantsIdentifiers.verifiedUsiInfo.dateOfBirthMatch": true
      })
    ]);

    // Process results with safe fallbacks
    const lastMonthEnrolled = lastMonthEnrolledResult[0]?.count ?? 0;

    return {
      totalStudents,
      joinedThisYear,
      lastMonthEnrolled,
      usiVerifiedCount
    };
  } catch (error) {
    logger.error("Error fetching student statistics:", error);
    throw new AppError(httpStatus.BAD_REQUEST, "STUDENT_STATISTICS_ERROR", "Failed to retrieve student statistics");
  }
};

// qualification statistics
interface QualificationStats {
  totalQualifications: number;
  activeQualifications: number;
}

const qualificationStatistics = async (organizationId: string): Promise<QualificationStats> => {
  // Validate organization ID
  if (!organizationId || !Types.ObjectId.isValid(organizationId)) {
    throw new Error("Invalid organization ID");
  }

  const now = new Date();

  try {
    // Run all queries in parallel for better performance
    const [totalQualifications, activeQualificationsResult] = await Promise.all([
      // 1. Total Qualifications in organization
      QualificationModel.countDocuments({ organizationId }),

      // 2. Active Qualifications (qualifications used in classes that haven't ended yet)
      ClassModel.aggregate([
        { $match: { organizationId } },
        {
          $match: {
            "classDetails.endDate": { $gte: now }
          }
        },
        {
          $group: {
            _id: "$qualification._id" // Group by unique qualification ID
          }
        },
        { $count: "count" }
      ])
    ]);

    // Process results with safe fallbacks
    const activeQualifications = activeQualificationsResult[0]?.count ?? 0;

    return {
      totalQualifications,
      activeQualifications
    };
  } catch (error) {
    logger.error("Error fetching qualification statistics:", error);
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "QUALIFICATION_STATISTICS_ERROR",
      "Failed to retrieve qualification statistics"
    );
  }
};

// class statistics
interface ClassStats {
  totalClasses: number;
  totalEnrollments: number;
  activeClasses: number;
}

const classStatistics = async (organizationId: string): Promise<ClassStats> => {
  // Validate organization ID
  if (!organizationId || !Types.ObjectId.isValid(organizationId)) {
    throw new Error("Invalid organization ID");
  }

  const now = new Date();

  try {
    // Run all queries in parallel for better performance
    const [totalClasses, totalEnrollmentsResult, activeClasses] = await Promise.all([
      // 1. Total Classes in organization
      ClassModel.countDocuments({ organizationId }),

      // 2. Total Enrollments (all time, across all classes)
      ClassModel.aggregate([{ $match: { organizationId } }, { $unwind: "$enrollments" }, { $count: "count" }]),

      // 3. Active Classes (startDate <= now <= endDate)
      ClassModel.countDocuments({
        organizationId,
        "classDetails.startDate": { $lte: now },
        "classDetails.endDate": { $gte: now }
      })
    ]);

    // Process results with safe fallbacks
    const totalEnrollments = totalEnrollmentsResult[0]?.count ?? 0;

    return {
      totalClasses,
      totalEnrollments,
      activeClasses
    };
  } catch (error) {
    logger.error("Error fetching class statistics:", error);
    throw new AppError(httpStatus.BAD_REQUEST, "CLASS_STATISTICS_ERROR", "Failed to retrieve class statistics");
  }
};

// trainers statistics
interface TrainerStats {
  totalTrainers: number;
  activeTrainers: number;
}

const trainerStatistics = async (organizationId: string): Promise<TrainerStats> => {
  // Validate organization ID
  if (!organizationId || !Types.ObjectId.isValid(organizationId)) {
    throw new Error("Invalid organization ID");
  }

  const now = new Date();

  try {
    // Run all queries in parallel for better performance
    const [totalTrainers, activeTrainersResult] = await Promise.all([
      // 1. Total Trainers in organization
      TrainerModel.countDocuments({ organizationId }),

      // 2. Active Trainers (assigned to classes that haven't ended yet)
      ClassModel.aggregate([
        { $match: { organizationId } },
        {
          $match: {
            "classDetails.endDate": { $gte: now }
          }
        },
        {
          $project: {
            trainers: {
              $concatArrays: [
                // [{ $toString: "$classDetails.defaultTrainer" }],
                ["$classDetails.defaultTrainer"],
                {
                  $map: {
                    input: { $ifNull: ["$classDetails.additionalTrainers", []] },
                    as: "trainer",
                    // in: { $toString: "$$trainer" }
                    in: "$$trainer"
                  }
                }
              ]
            }
          }
        },
        { $unwind: "$trainers" },
        {
          $group: {
            _id: "$trainers" // Get unique trainer IDs
          }
        },
        { $count: "count" }
      ])
    ]);

    // Process results with safe fallbacks
    const activeTrainers = activeTrainersResult[0]?.count ?? 0;

    return {
      totalTrainers,
      activeTrainers
    };
  } catch (error) {
    logger.error("Error fetching trainer statistics:", error);
    throw new AppError(httpStatus.BAD_REQUEST, "TRAINERS_STATISTICS_ERROR", "Failed to retrieve trainers statistics");
  }
};

export const statisticsService = {
  dashboardStatistics,
  studentStatistics,
  qualificationStatistics,
  classStatistics,
  trainerStatistics
};

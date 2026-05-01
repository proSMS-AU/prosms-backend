import { Request, Response } from "express";
import { SendSuccessResponse } from "../utils";
import { statisticsService } from "../services/statistics.service";

// Handler for dashboard statistics
const dashboardStatisticsHandler = async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId as string;

  const dashboardStats = await statisticsService.dashboardStatistics(organizationId);

  return SendSuccessResponse.success({
    res,
    message: "Dashboard statistics retrieved successfully!",
    data: dashboardStats
  });
};

// Handler for student statistics
const studentStatisticsHandler = async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId as string;

  const studentStats = await statisticsService.studentStatistics(organizationId);

  return SendSuccessResponse.success({
    res,
    message: "Student statistics retrieved successfully!",
    data: studentStats
  });
};

// Handler for student statistics
const qualificationStatisticsHandler = async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId as string;

  const qualificationStats = await statisticsService.qualificationStatistics(organizationId);

  return SendSuccessResponse.success({
    res,
    message: "Qualification statistics retrieved successfully!",
    data: qualificationStats
  });
};

// Handler for student statistics
const classStatisticsHandler = async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId as string;

  const classStats = await statisticsService.classStatistics(organizationId);

  return SendSuccessResponse.success({
    res,
    message: "Class statistics retrieved successfully!",
    data: classStats
  });
};

// handler for trainers statistics
const trainerStatisticsHandler = async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId as string;

  const trainerStats = await statisticsService.trainerStatistics(organizationId);

  return SendSuccessResponse.success({
    res,
    message: "Trainer statistics retrieved successfully!",
    data: trainerStats
  });
};

export const statisticsController = {
  dashboardStatisticsHandler,
  studentStatisticsHandler,
  qualificationStatisticsHandler,
  classStatisticsHandler,
  trainerStatisticsHandler
};

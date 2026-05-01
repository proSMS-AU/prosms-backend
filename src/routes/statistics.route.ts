import { Router } from "express";
import { statisticsController } from "../controllers/statistics.controller";

const router = Router();

router.get("/dashboard", statisticsController.dashboardStatisticsHandler);
router.get("/student", statisticsController.studentStatisticsHandler);
router.get("/qualification", statisticsController.qualificationStatisticsHandler);
router.get("/class", statisticsController.classStatisticsHandler);
router.get("/trainer", statisticsController.trainerStatisticsHandler);

export default router;

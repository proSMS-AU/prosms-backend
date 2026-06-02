import { Router } from "express";
import { asyncWrapper } from "../utils";
import { ActivityLogController } from "../controllers/activityLog.controller";

const router = Router();

router.get("/", asyncWrapper(ActivityLogController.getActivityLogHandler));
router.post("/:logId/undo", asyncWrapper(ActivityLogController.undoActivityHandler));

export default router;

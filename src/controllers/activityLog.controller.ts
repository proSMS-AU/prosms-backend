import { Request, Response } from "express";
import { SendSuccessResponse } from "../utils";
import { ActivityLogService } from "../services/activityLog.service";
import { UndoService } from "../services/undo.service";

const getActivityLogHandler = async (req: Request, res: Response) => {
  const { entityType, entityId, limit, page } = req.query as Record<string, string>;
  const result = await ActivityLogService.getActivityLog({
    organizationId: req.user!.organizationId as string,
    entityType,
    entityId,
    limit: limit ? parseInt(limit) : 50,
    page: page ? parseInt(page) : 1
  });
  SendSuccessResponse.success({
    res,
    message: "Activity log retrieved",
    data: result
  });
};

const undoActivityHandler = async (req: Request, res: Response) => {
  const result = await UndoService.undoActivity(req.params.logId, req.user!.organizationId as string);
  SendSuccessResponse.success({ res, message: "Action undone successfully", data: result });
};

export const ActivityLogController = { getActivityLogHandler, undoActivityHandler };

import { ActivityLogModel } from "../model/activity-log.model";
import { StudentModel } from "../model/student.model";
import { AppError } from "../utils/appError";
import { httpStatus } from "../constants";
import { ActivityEntityType } from "../model/activity-log.model";

const UNDO_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

type UndoResult = { undone: true; entityType: string; entityId: string } | { undone: false };

type UndoHandler = (entityId: string, action: string) => Promise<UndoResult>;

const undoHandlers: Partial<Record<ActivityEntityType, UndoHandler>> = {
  student: async (entityId, action) => {
    if (action === "delete") {
      await StudentModel.findByIdAndUpdate(entityId, {
        $set: { isDeleted: false },
        $unset: { deletedAt: "" }
      });
      return { undone: true, entityType: "student", entityId };
    }
    return { undone: false };
  },

  // Enrollment and class undo require soft-delete support on those models (not yet implemented).
  // Register handlers here once isDeleted/deletedAt are added to ClassModel / embedded Enrollments.
  enrollment: async (_entityId, _action) => {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "UNDO_NOT_SUPPORTED",
      "Undo for enrollment requires soft-delete support — not yet implemented"
    );
  },

  class: async (_entityId, _action) => {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "UNDO_NOT_SUPPORTED",
      "Undo for class requires soft-delete support — not yet implemented"
    );
  }
};

const undoActivity = async (logId: string, orgId: string): Promise<UndoResult> => {
  const log = await ActivityLogModel.findOne({ _id: logId, organizationId: orgId });
  if (!log) {
    throw new AppError(httpStatus.NOT_FOUND, "ACTIVITY_LOG_NOT_FOUND", "Activity log entry not found");
  }

  const ageMs = Date.now() - new Date(log.createdAt as Date).getTime();
  if (ageMs > UNDO_WINDOW_MS) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "UNDO_WINDOW_EXPIRED",
      "The 30-minute undo window has passed for this action"
    );
  }

  const handler = undoHandlers[log.entityType as ActivityEntityType];
  if (!handler) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "UNDO_NOT_SUPPORTED",
      `Undo is not supported for action "${log.action}" on "${log.entityType}"`
    );
  }

  const result = await handler(log.entityId, log.action);
  if (result.undone) {
    await ActivityLogModel.findByIdAndDelete(logId);
  }
  return result;
};

export const UndoService = { undoActivity };

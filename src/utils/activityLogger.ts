import { ActivityLogModel, ActivityAction, ActivityEntityType } from "../model/activity-log.model";
import { logger } from "./logger";

interface LogActivityOptions {
  organizationId: string;
  actorUserId?: string;
  entityType: ActivityEntityType;
  entityId: string;
  entityLabel?: string;
  action: ActivityAction;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  description?: string;
  undoable?: boolean;
}

export const logActivity = async (options: LogActivityOptions): Promise<void> => {
  try {
    await ActivityLogModel.create(options);
  } catch (err) {
    // Non-blocking — don't throw
    logger.warn("[ActivityLog] Failed to write activity log:", err);
  }
};

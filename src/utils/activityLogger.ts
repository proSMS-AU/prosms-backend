import { ActivityLogModel, ActivityAction, ActivityEntityType } from "../model/activity-log.model";

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
}

export const logActivity = async (options: LogActivityOptions): Promise<void> => {
  try {
    await ActivityLogModel.create(options);
  } catch (err) {
    // Non-blocking — log to console but don't throw
    console.warn("[ActivityLog] Failed to write activity log:", err);
  }
};

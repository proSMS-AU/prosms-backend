import { ActivityLogModel } from "../model/activity-log.model";

const getActivityLog = async (params: {
  organizationId: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
  page?: number;
}) => {
  const { organizationId, entityType, entityId, limit = 50, page = 1 } = params;

  const filter: Record<string, unknown> = { organizationId };
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;

  const total = await ActivityLogModel.countDocuments(filter);
  const logs = await ActivityLogModel.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const ActivityLogService = { getActivityLog };

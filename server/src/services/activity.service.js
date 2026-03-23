import { getTenantModels } from '../config/tenantDb.js';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listActivity({ companyId, workspaceId, limit = 50, q, type, entityType, days }) {
  const tenantId = companyId;
  const { ActivityLog, User } = getTenantModels();

  const filter = { tenantId, workspaceId };

  if (type) filter.type = type;
  if (entityType) filter.entityType = entityType;

  if (days && Number(days) > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(days));
    filter.createdAt = { $gte: cutoff };
  }

  if (q?.trim()) {
    const regex = new RegExp(escapeRegExp(q.trim()), 'i');
    filter.$or = [
      { description: regex },
      { type: regex },
      { entityType: regex },
    ];
  }

  const items = await ActivityLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const userIds = [...new Set(items.map((item) => String(item.userId)).filter(Boolean))];
  const users = userIds.length > 0
    ? await User.find({ _id: { $in: userIds } }).select('name email role').lean()
    : [];

  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return items.map((item) => {
    const user = userMap.get(String(item.userId));
    return {
      id: String(item._id),
      type: item.type,
      description: item.description,
      entityType: item.entityType,
      entityId: String(item.entityId),
      metadata: item.metadata || {},
      createdAt: item.createdAt?.toISOString?.() || item.createdAt,
      user: user
        ? {
            id: String(user._id),
            name: user.name,
            email: user.email,
            role: user.role,
          }
        : null,
    };
  });
}


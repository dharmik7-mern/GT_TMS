import { getTenantModels } from '../config/tenantDb.js';
import NotificationBroadcast from '../models/NotificationBroadcast.js';
import AuthLookup from '../models/AuthLookup.js';

export async function listNotifications({ companyId, workspaceId, userId, page = 1, limit = 50 }) {
  const tenantId = companyId;
  const { Notification } = getTenantModels();
  const filter = { tenantId, workspaceId, userId };
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function markRead({ companyId, workspaceId, userId, id }) {
  const tenantId = companyId;
  const { Notification } = getTenantModels();
  const n = await Notification.findOneAndUpdate(
    { _id: id, tenantId, workspaceId, userId },
    { $set: { isRead: true } },
    { new: true }
  );
  return n;
}

export async function markAllRead({ companyId, workspaceId, userId }) {
  const tenantId = companyId;
  const { Notification } = getTenantModels();
  await Notification.updateMany({ tenantId, workspaceId, userId, isRead: false }, { $set: { isRead: true } });
}

export async function listBroadcastHistory({ page = 1, limit = 50 }) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    NotificationBroadcast.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    NotificationBroadcast.countDocuments(),
  ]);
  return { items, total, page, limit };
}

export async function createBroadcast({ actorRole, actorUserId, input }) {
  if (!['super_admin', 'admin'].includes(actorRole)) {
    const err = new Error('You do not have permission to broadcast notifications');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const { User, Membership, Notification } = getTenantModels();

  let memberships = [];
  let audienceLabel = 'All Users';

  if (input.targetType === 'all') {
    memberships = await Membership.find({ status: 'active' }).sort({ createdAt: 1 });
  } else if (input.targetType === 'company') {
    memberships = await Membership.find({ status: 'active', tenantId: input.companyId }).sort({ createdAt: 1 });
    audienceLabel = input.companyName || 'Selected Company';
  } else {
    const email = input.userEmail.trim().toLowerCase();
    const lookup = await AuthLookup.findOne({ email });
    if (!lookup) {
      const err = new Error('Target user was not found');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }
    const user = await User.findOne({ email, tenantId: lookup.tenantId, isActive: true });
    if (!user) {
      const err = new Error('Target user was not found');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }
    memberships = await Membership.find({ status: 'active', userId: user._id, tenantId: lookup.tenantId }).sort({ createdAt: 1 });
    audienceLabel = user.email;
  }

  const uniqueMemberships = [];
  const seenUsers = new Set();
  for (const membership of memberships) {
    const key = String(membership.userId);
    if (seenUsers.has(key)) continue;
    seenUsers.add(key);
    uniqueMemberships.push(membership);
  }

  const userIds = uniqueMemberships.map((membership) => membership.userId);
  const users = await User.find({ _id: { $in: userIds }, isActive: true });
  const activeUsers = new Map(users.map((user) => [String(user._id), user]));
  const recipients = uniqueMemberships.filter((membership) => activeUsers.has(String(membership.userId)));

  const broadcast = await NotificationBroadcast.create({
    createdBy: actorUserId,
    targetType: input.targetType,
    targetLabel: audienceLabel,
    messageType: input.messageType,
    title: input.title.trim(),
    message: input.message.trim(),
    reachCount: recipients.length,
  });

  if (recipients.length) {
    await Notification.insertMany(
      recipients.map((membership) => ({
        tenantId: membership.tenantId,
        workspaceId: membership.workspaceId,
        userId: membership.userId,
        type: 'broadcast',
        title: input.title.trim(),
        message: input.message.trim(),
        isRead: false,
        relatedId: null,
        audienceType: input.targetType,
        audienceLabel,
        broadcastId: broadcast._id,
      }))
    );
  }

  return broadcast;
}


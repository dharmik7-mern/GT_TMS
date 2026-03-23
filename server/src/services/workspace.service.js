import { getTenantModels } from '../config/tenantDb.js';

export async function listWorkspacesForUser({ userId, companyId }) {
  const tenantId = companyId;
  const { Workspace, Membership } = getTenantModels();
  const memberships = await Membership.find({ userId, tenantId, status: 'active' }).select('workspaceId');
  const ids = memberships.map((m) => m.workspaceId);
  const items = await Workspace.find({ _id: { $in: ids }, tenantId }).sort({ createdAt: -1 });
  const counts = await Promise.all(items.map((item) => Membership.countDocuments({ workspaceId: item._id, tenantId, status: 'active' })));
  return items.map((item, index) => ({
    ...item.toJSON(),
    membersCount: counts[index],
  }));
}

export async function updateWorkspace({ companyId, workspaceId, userId, role, updates }) {
  const tenantId = companyId;
  const { Workspace } = getTenantModels();
  const workspace = await Workspace.findOne({ _id: workspaceId, tenantId });
  if (!workspace) return null;

  const canEdit = role === 'super_admin' || role === 'admin' || String(workspace.ownerId) === String(userId);
  if (!canEdit) {
    const err = new Error('You do not have permission to edit this workspace');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (typeof updates.name === 'string' && updates.name.trim()) workspace.name = updates.name.trim();
  if (typeof updates.slug === 'string' && updates.slug.trim()) workspace.slug = updates.slug.trim().toLowerCase();
  if (updates.settings && typeof updates.settings === 'object') {
    workspace.settings = {
      ...(workspace.settings?.toObject?.() || workspace.settings || {}),
      ...updates.settings,
    };
  }

  await workspace.save();
  return workspace.toJSON();
}

export async function exportWorkspaceData({ companyId, workspaceId, userId, role }) {
  const tenantId = companyId;
  const { Workspace, Membership, Project, Task, Team, QuickTask, Notification, ActivityLog, User } = getTenantModels();
  const workspace = await Workspace.findOne({ _id: workspaceId, tenantId });
  if (!workspace) return null;

  const canAccess = role === 'super_admin' || role === 'admin' || String(workspace.ownerId) === String(userId);
  if (!canAccess) {
    const err = new Error('You do not have permission to export this workspace');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const [memberships, projects, tasks, teams, quickTasks, notifications, activity] = await Promise.all([
    Membership.find({ tenantId, workspaceId }),
    Project.find({ tenantId, workspaceId }),
    Task.find({ tenantId, workspaceId }),
    Team.find({ tenantId, workspaceId }),
    QuickTask.find({ tenantId, workspaceId }),
    Notification.find({ tenantId, workspaceId }),
    ActivityLog.find({ tenantId, workspaceId }).sort({ createdAt: -1 }).limit(500),
  ]);

  const memberIds = [...new Set(memberships.map((m) => String(m.userId)))];
  const users = await User.find({ _id: { $in: memberIds }, tenantId });

  return {
    exportedAt: new Date().toISOString(),
    workspace: workspace.toJSON(),
    users: users.map((item) => item.toJSON()),
    memberships: memberships.map((item) => item.toJSON()),
    projects: projects.map((item) => item.toJSON()),
    tasks: tasks.map((item) => item.toJSON()),
    teams: teams.map((item) => item.toJSON()),
    quickTasks: quickTasks.map((item) => item.toJSON()),
    notifications: notifications.map((item) => item.toJSON()),
    activity: activity.map((item) => item.toJSON()),
  };
}


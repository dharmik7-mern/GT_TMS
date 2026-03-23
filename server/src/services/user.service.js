import AuthLookup from '../models/AuthLookup.js';
import { getTenantModels } from '../config/tenantDb.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { assertPasswordAllowed } from './settings.service.js';

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function normalizeEmployeeIdConfig(config) {
  return {
    prefix: String(config?.prefix ?? 'EMP').trim().slice(0, 20),
    separator: String(config?.separator ?? '-').slice(0, 3),
    digits: Math.max(1, Math.min(8, Number(config?.digits ?? 4) || 4)),
    nextSequence: Math.max(1, Number(config?.nextSequence ?? 1) || 1),
  };
}

function formatEmployeeId(config, sequence) {
  const normalized = normalizeEmployeeIdConfig(config);
  return `${normalized.prefix}${normalized.separator}${String(sequence).padStart(normalized.digits, '0')}`;
}

export async function getMe({ companyId, userId }) {
  const tenantId = companyId;
  const { User } = getTenantModels();
  const user = await User.findOne({ _id: userId, tenantId });
  return user;
}

export async function listUsers({ companyId, actorRole }) {
  const { User } = getTenantModels();
  let filter = { tenantId: companyId };

  if (actorRole === 'super_admin') {
    filter = {}; // super_admin can see everyone
  }

  const users = await User.find(filter).sort({ createdAt: -1 });
  return users;
}

export async function getUser({ companyId, id }) {
  const tenantId = companyId;
  const { User } = getTenantModels();
  const user = await User.findOne({ _id: id, tenantId });
  return user;
}

export async function getUserPerformance({ companyId, workspaceId, targetUserId }) {
  const tenantId = companyId;
  const { User, Task, QuickTask, Project } = getTenantModels();
  const user = await User.findOne({ _id: targetUserId, tenantId }).lean();
  if (!user) return null;

  const [projectTasks, quickTasks, projects] = await Promise.all([
    Task.find({
      tenantId,
      workspaceId,
      assigneeIds: targetUserId,
      $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }],
    }).lean(),
    QuickTask.find({ tenantId, workspaceId, assigneeIds: targetUserId }).lean(),
    Project.find({ tenantId, workspaceId, members: targetUserId }).select('_id name status').lean(),
  ]);

  const allAssigned = [
    ...projectTasks.map((task) => ({ ...task, kind: 'project_task' })),
    ...quickTasks.map((task) => ({ ...task, kind: 'quick_task' })),
  ];

  const completed = allAssigned.filter((task) => task.status === 'done');
  const approved = completed.filter((task) => task.completionReview?.reviewStatus === 'approved');
  const pendingReview = completed.filter((task) => task.completionReview?.reviewStatus === 'pending');
  const changesRequested = allAssigned.filter((task) => task.completionReview?.reviewStatus === 'changes_requested');
  const rated = approved.filter((task) => typeof task.completionReview?.rating === 'number');
  const overdueOpen = allAssigned.filter((task) => {
    const due = asDate(task.dueDate);
    return due && due < new Date() && task.status !== 'done';
  });
  const onTimeCompleted = completed.filter((task) => {
    const completedAt = asDate(task.completionReview?.completedAt);
    const due = asDate(task.dueDate);
    if (!completedAt || !due) return false;
    return completedAt <= due;
  });

  const ratingDistribution = [1, 2, 3, 4, 5].map((value) => ({
    rating: value,
    count: rated.filter((task) => task.completionReview.rating === value).length,
  }));

  const monthlyMap = new Map();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - offset);
    const key = monthKey(date);
    monthlyMap.set(key, { month: monthLabel(key), completed: 0, approved: 0, averageRating: 0, ratingsCount: 0 });
  }

  for (const task of completed) {
    const completedAt = asDate(task.completionReview?.completedAt) || asDate(task.updatedAt) || asDate(task.createdAt);
    if (!completedAt) continue;
    const key = monthKey(completedAt);
    if (!monthlyMap.has(key)) continue;
    const bucket = monthlyMap.get(key);
    bucket.completed += 1;
    if (task.completionReview?.reviewStatus === 'approved') bucket.approved += 1;
    if (typeof task.completionReview?.rating === 'number') {
      bucket.averageRating += task.completionReview.rating;
      bucket.ratingsCount += 1;
    }
  }

  const monthlyTrend = Array.from(monthlyMap.values()).map((bucket) => ({
    month: bucket.month,
    completed: bucket.completed,
    approved: bucket.approved,
    averageRating: bucket.ratingsCount ? Number((bucket.averageRating / bucket.ratingsCount).toFixed(1)) : 0,
  }));

  const recentEvaluations = approved
    .filter((task) => task.completionReview?.reviewedAt)
    .sort((a, b) => new Date(b.completionReview.reviewedAt).getTime() - new Date(a.completionReview.reviewedAt).getTime())
    .slice(0, 8)
    .map((task) => ({
      id: String(task._id),
      type: task.kind,
      title: task.title,
      projectId: task.projectId ? String(task.projectId) : undefined,
      rating: task.completionReview?.rating,
      reviewRemark: task.completionReview?.reviewRemark || '',
      reviewedAt: asDate(task.completionReview?.reviewedAt)?.toISOString(),
      completedAt: asDate(task.completionReview?.completedAt)?.toISOString(),
    }));

  const averageRating = rated.length
    ? Number((rated.reduce((sum, task) => sum + task.completionReview.rating, 0) / rated.length).toFixed(1))
    : 0;
  const completionRate = allAssigned.length ? Math.round((completed.length / allAssigned.length) * 100) : 0;
  const approvalRate = completed.length ? Math.round((approved.length / completed.length) * 100) : 0;
  const onTimeRate = completed.length ? Math.round((onTimeCompleted.length / completed.length) * 100) : 0;
  const performanceScore = Math.max(
    0,
    Math.min(
      100,
      Math.round((completionRate * 0.35) + (approvalRate * 0.25) + (onTimeRate * 0.2) + ((averageRating / 5) * 100 * 0.2))
    )
  );

  return {
    userId: String(user._id),
    summary: {
      assignedTasks: allAssigned.length,
      completedTasks: completed.length,
      approvedTasks: approved.length,
      pendingReviewTasks: pendingReview.length,
      changesRequestedTasks: changesRequested.length,
      overdueOpenTasks: overdueOpen.length,
      averageRating,
      completionRate,
      approvalRate,
      onTimeRate,
      performanceScore,
      activeProjects: projects.length,
    },
    ratingDistribution,
    monthlyTrend,
    activeProjects: projects.map((project) => ({
      id: String(project._id),
      name: project.name,
      status: project.status,
    })),
    recentEvaluations,
  };
}

export async function createUser({ companyId, workspaceId, actorRole, input }) {
  let tenantId = companyId;
  let targetWorkspaceId = workspaceId;
  const { User, Membership, Workspace } = getTenantModels();
  if (!['super_admin', 'admin'].includes(actorRole)) {
    const err = new Error('Only company admins can create users');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const requestedCompanyId = typeof input.companyId === 'string' ? input.companyId.trim() : '';
  if (actorRole === 'super_admin' && requestedCompanyId) {
    tenantId = requestedCompanyId;
    const workspace = await Workspace.findOne({ tenantId }).sort({ createdAt: 1 });
    if (!workspace) {
      const err = new Error('Selected company has no workspace configured');
      err.statusCode = 400;
      err.code = 'WORKSPACE_NOT_FOUND';
      throw err;
    }
    targetWorkspaceId = workspace._id;
  }

  const allowedRoles = actorRole === 'super_admin'
    ? ['super_admin', 'admin', 'manager', 'team_leader', 'team_member']
    : ['admin', 'manager', 'team_leader', 'team_member'];

  if (!allowedRoles.includes(input.role)) {
    const err = new Error('You are not allowed to create a user with this role');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }

  const email = input.email.trim().toLowerCase();
  const existingLookup = await AuthLookup.findOne({ email });
  if (existingLookup) {
    const err = new Error('A user with this email already exists');
    err.statusCode = 409;
    err.code = 'USER_EXISTS';
    throw err;
  }

  const existing = await User.findOne({ tenantId, email });
  if (existing) {
    const err = new Error('A user with this email already exists in this company');
    err.statusCode = 409;
    err.code = 'USER_EXISTS';
    throw err;
  }

  await assertPasswordAllowed(input.password, { companyId: tenantId, workspaceId: targetWorkspaceId });

  const workspace = await Workspace.findOne({ _id: targetWorkspaceId, tenantId });
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.statusCode = 400;
    err.code = 'WORKSPACE_NOT_FOUND';
    throw err;
  }

  const employeeIdConfig = normalizeEmployeeIdConfig(workspace.settings?.employeeIdConfig);
  let nextSequence = employeeIdConfig.nextSequence;
  let employeeId = formatEmployeeId(employeeIdConfig, nextSequence);
  while (await User.exists({ tenantId, employeeId })) {
    nextSequence += 1;
    employeeId = formatEmployeeId(employeeIdConfig, nextSequence);
  }

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    tenantId,
    name: input.name.trim(),
    email,
    employeeId,
    passwordHash,
    role: input.role,
    jobTitle: input.jobTitle?.trim() || '',
    department: input.department?.trim() || '',
    isActive: true,
    color: input.color?.trim() || '#3366ff',
  });

  workspace.settings = {
    ...(workspace.settings?.toObject?.() || workspace.settings || {}),
    employeeIdConfig: {
      ...employeeIdConfig,
      nextSequence: nextSequence + 1,
    },
  };
  await workspace.save();

  await AuthLookup.updateOne(
    { email },
    { $set: { email, tenantId } },
    { upsert: true }
  );

  await Membership.updateOne(
    { tenantId, workspaceId: targetWorkspaceId, userId: user._id },
    { $setOnInsert: { role: input.role, status: 'active' } },
    { upsert: true }
  );

  return user;
}

export async function importUsersBulk({ companyId, workspaceId, actorRole, rows }) {
  if (!['super_admin', 'admin'].includes(actorRole)) {
    const err = new Error('Only company admins can import users');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const normalizedRows = Array.isArray(rows) ? rows : [];
  if (normalizedRows.length === 0) {
    const err = new Error('No users provided for import');
    err.statusCode = 400;
    err.code = 'IMPORT_EMPTY';
    throw err;
  }

  const createdUsers = [];
  const failures = [];

  for (let index = 0; index < normalizedRows.length; index += 1) {
    const row = normalizedRows[index] || {};
    const input = {
      name: String(row.name ?? '').trim(),
      email: String(row.email ?? '').trim(),
      password: String(row.password ?? '').trim(),
      role: String(row.role ?? 'team_member').trim() || 'team_member',
      jobTitle: String(row.jobTitle ?? '').trim(),
      department: String(row.department ?? '').trim(),
      color: typeof row.color === 'string' ? row.color.trim() : undefined,
    };

    const rowNumber = Number(row.rowNumber) > 0 ? Number(row.rowNumber) : index + 2;

    try {
      const user = await createUser({
        companyId,
        workspaceId,
        actorRole,
        input,
      });
      createdUsers.push(user);
    } catch (error) {
      failures.push({
        rowNumber,
        email: input.email,
        name: input.name,
        message: error?.message || 'Failed to import user',
        code: error?.code || 'IMPORT_FAILED',
      });
    }
  }

  return {
    totalRows: normalizedRows.length,
    createdCount: createdUsers.length,
    failedCount: failures.length,
    createdUsers,
    failures,
  };
}

export async function updateUser({ companyId, workspaceId, actorRole, userId, targetUserId, updates }) {
  const tenantId = companyId;
  const { User, Membership } = getTenantModels();
  if (!['super_admin', 'admin'].includes(actorRole)) {
    const err = new Error('Only company admins can update users');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const user = await User.findOne({ _id: targetUserId, tenantId });
  if (!user) return null;

  if (String(user._id) === String(userId) && updates.role && updates.role !== user.role) {
    const err = new Error('You cannot change your own role');
    err.statusCode = 400;
    err.code = 'SELF_ROLE_CHANGE_BLOCKED';
    throw err;
  }

  const allowedRoles = actorRole === 'super_admin'
    ? ['super_admin', 'admin', 'manager', 'team_leader', 'team_member']
    : ['admin', 'manager', 'team_leader', 'team_member'];

  if (updates.role && !allowedRoles.includes(updates.role)) {
    const err = new Error('You are not allowed to assign this role');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }

  if (typeof updates.email === 'string') {
    const email = updates.email.trim().toLowerCase();
    if (email !== user.email) {
      const existingLookup = await AuthLookup.findOne({ email });
      if (existingLookup) {
        const err = new Error('A user with this email already exists');
        err.statusCode = 409;
        err.code = 'USER_EXISTS';
        throw err;
      }

      await AuthLookup.deleteOne({ email: user.email });
      await AuthLookup.updateOne(
        { email },
        { $set: { email, tenantId } },
        { upsert: true }
      );
      user.email = email;
    }
  }

  if (typeof updates.name === 'string') user.name = updates.name.trim();
  if (typeof updates.role === 'string') user.role = updates.role;
  if (typeof updates.jobTitle === 'string') user.jobTitle = updates.jobTitle.trim();
  if (typeof updates.department === 'string') user.department = updates.department.trim();
  if (typeof updates.isActive === 'boolean') user.isActive = updates.isActive;
  if (typeof updates.color === 'string') user.color = updates.color.trim();

  await user.save();

  await Membership.updateMany(
    { tenantId, userId: user._id, ...(workspaceId ? { workspaceId } : {}) },
    {
      $set: {
        ...(updates.role ? { role: updates.role } : {}),
        ...(typeof updates.isActive === 'boolean' ? { status: updates.isActive ? 'active' : 'disabled' } : {}),
      },
    }
  );

  return user;
}

export async function deleteUser({ companyId, actorRole, userId, targetUserId }) {
  const tenantId = companyId;
  const { User, Membership } = getTenantModels();
  if (!['super_admin', 'admin'].includes(actorRole)) {
    const err = new Error('Only company admins can delete users');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (String(userId) === String(targetUserId)) {
    const err = new Error('You cannot delete your own account');
    err.statusCode = 400;
    err.code = 'SELF_DELETE_BLOCKED';
    throw err;
  }

  const user = await User.findOneAndDelete({ _id: targetUserId, tenantId });
  if (!user) return null;

  await Membership.deleteMany({ tenantId, userId: user._id });
  await AuthLookup.deleteOne({ email: user.email });
  return user;
}

export async function updateMe({ companyId, userId, updates }) {
  const tenantId = companyId;
  const { User } = getTenantModels();
  const payload = {};

  if (typeof updates.name === 'string') payload.name = updates.name.trim();
  if (typeof updates.jobTitle === 'string') payload.jobTitle = updates.jobTitle.trim();
  if (typeof updates.department === 'string') payload.department = updates.department.trim();
  if (typeof updates.bio === 'string') payload.bio = updates.bio.trim();
  if (typeof updates.color === 'string') payload.color = updates.color.trim();

  const user = await User.findOneAndUpdate(
    { _id: userId, tenantId },
    { $set: payload },
    { new: true }
  );
  return user;
}

export async function updateMyPreferences({ companyId, userId, preferences }) {
  const tenantId = companyId;
  const { User } = getTenantModels();

  const setPayload = {};
  for (const [groupKey, groupValue] of Object.entries(preferences || {})) {
    if (!groupValue || typeof groupValue !== 'object' || Array.isArray(groupValue)) continue;
    for (const [key, value] of Object.entries(groupValue)) {
      setPayload[`preferences.${groupKey}.${key}`] = value;
    }
  }

  const user = await User.findOneAndUpdate(
    { _id: userId, tenantId },
    { $set: setPayload },
    { new: true }
  );
  return user;
}

export async function updateMyPassword({ companyId, userId, currentPassword, newPassword }) {
  const tenantId = companyId;
  const { User } = getTenantModels();
  const user = await User.findOne({ _id: userId, tenantId }).select('+passwordHash');
  if (!user) return null;

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    const err = new Error('Current password is incorrect');
    err.statusCode = 400;
    err.code = 'BAD_PASSWORD';
    throw err;
  }

  await assertPasswordAllowed(newPassword, { companyId: tenantId, workspaceId });
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  return true;
}


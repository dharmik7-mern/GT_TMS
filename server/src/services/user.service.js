import mongoose from 'mongoose';
import AuthLookup from '../models/AuthLookup.js';
import { getUserModel } from '../models/User.js';
import { getTenantModels } from '../config/tenantDb.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { assertPasswordAllowed } from './settings.service.js';
import { sendTemplatedEmailSafe } from './mail.service.js';
import { getTaskActivityModel } from '../models/TaskActivity.js';

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
  const { User } = await getTenantModels(companyId);
  const user = await User.findOne({ _id: userId, tenantId });
  return user;
}

export async function listUsers({ companyId, actorRole }) {
  const tenantId = companyId;
  const { User: TenantUser } = await getTenantModels(companyId);
  const BaseUser = getUserModel(mongoose.connection);
  
  // Connect to HRMS Tenant DB
  const hrmsConn = mongoose.connection.useDb(`company_${companyId}`);
  const hrmsEmployeeColl = hrmsConn.db.collection('employees');

  let filter = { tenantId: companyId };
  if (actorRole === 'super_admin') {
    filter = {}; // super_admin can see everyone
  }

  // Fetch from all sources
  const [tenantUsers, hrmsGlobalUsers, hrmsTenantEmployees] = await Promise.all([
    TenantUser.find(filter).lean(),
    BaseUser.find(filter).lean(),
    hrmsEmployeeColl.find({}).toArray().catch(() => []), // Might not exist
  ]);

  // Merge and deduplicate by email
  const userMap = new Map();

  // 1. HRMS Global Users
  hrmsGlobalUsers.forEach((u) => {
    userMap.set(u.email.toLowerCase(), { ...u, id: String(u._id) });
  });

  // 2. HRMS Tenant Employees (often have richer profile info like names, IDs)
  hrmsTenantEmployees.forEach((e) => {
    const email = (e.email || '').toLowerCase();
    if (!email) return;
    const existing = userMap.get(email);
    userMap.set(email, {
      ...(existing || {}),
      id: String(e._id),
      name: e.name || `${e.firstName || ''} ${e.lastName || ''}`.trim() || email,
      email,
      employeeId: e.employeeId,
      department: e.department,
      role: (e.role === 'Employee' ? 'team_member' : existing?.role) || 'team_member',
      isActive: e.isActive !== undefined ? e.isActive : true,
      createdAt: e.createdAt,
    });
  });

  // 3. TMS Tenant Users (Source of truth for TMS-specific settings)
  tenantUsers.forEach((u) => {
    const email = u.email.toLowerCase();
    const existing = userMap.get(email);
    userMap.set(email, {
      ...(existing || {}),
      ...u,
      id: String(u._id),
    });
  });

  return Array.from(userMap.values()).sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });
}

export async function getUser({ companyId, id }) {
  const tenantId = companyId;
  const { User: TenantUser } = await getTenantModels(companyId);
  const BaseUser = getUserModel(mongoose.connection);
  const hrmsConn = mongoose.connection.useDb(`company_${companyId}`);
  const hrmsEmployeeColl = hrmsConn.db.collection('employees');

  // Try tenant first
  let user = await TenantUser.findOne({ _id: id, tenantId }).lean();
  if (user) return { ...user, id: String(user._id) };

  // Try HRMS Global
  user = await BaseUser.findOne({ _id: id, tenantId }).lean();
  if (user) return { ...user, id: String(user._id) };

  // Try HRMS Tenant Employee
  if (mongoose.Types.ObjectId.isValid(id)) {
    const emp = await hrmsEmployeeColl.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (emp) {
      return {
        ...emp,
        id: String(emp._id),
        name: emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email,
        role: emp.role === 'Employee' ? 'team_member' : 'team_member', // Default mapping
      };
    }
  }

  return null;
}

export async function getUserPerformance({ companyId, workspaceId, targetUserId }) {
  const tenantId = companyId;
  const { User: TenantUser, Task, QuickTask, Project } = await getTenantModels(companyId);
  const BaseUser = getUserModel(mongoose.connection);

  // Try tenant first
  let user = await TenantUser.findOne({ _id: targetUserId, tenantId }).lean();
  if (!user) {
    // Fallback to HRMS
    user = await BaseUser.findOne({ _id: targetUserId, tenantId }).lean();
  }

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
    if (!due || task.status === 'done') return false;
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return due < todayMidnight;
  });
  const dueToday = allAssigned.filter((task) => {
    const due = asDate(task.dueDate);
    if (!due || task.status === 'done') return false;
    const today = new Date();
    return due.getFullYear() === today.getFullYear()
      && due.getMonth() === today.getMonth()
      && due.getDate() === today.getDate();
  });
  const todayCompleted = completed.filter((task) => {
    const completedAt = asDate(task.completionReview?.completedAt) || asDate(task.updatedAt);
    if (!completedAt) return false;
    const today = new Date();
    return completedAt.getFullYear() === today.getFullYear()
      && completedAt.getMonth() === today.getMonth()
      && completedAt.getDate() === today.getDate();
  });
  const onTimeCompleted = completed.filter((task) => {
    const completedAt = asDate(task.completionReview?.completedAt) || asDate(task.updatedAt);
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

  const currentWorkload = allAssigned
    .filter((task) => task.status !== 'done')
    .sort((a, b) => {
      const leftDue = asDate(a.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
      const rightDue = asDate(b.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
      if (leftDue !== rightDue) return leftDue - rightDue;
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
    })
    .slice(0, 8)
    .map((task) => ({
      id: String(task._id),
      type: task.kind,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: asDate(task.dueDate)?.toISOString(),
      projectId: task.projectId ? String(task.projectId) : undefined,
      projectName: task.projectId ? projects.find((project) => String(project._id) === String(task.projectId))?.name || '' : '',
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
      assignedProjectTasks: projectTasks.length,
      assignedQuickTasks: quickTasks.length,
      completedTasks: completed.length,
      completedProjectTasks: completed.filter((task) => task.kind === 'project_task').length,
      completedQuickTasks: completed.filter((task) => task.kind === 'quick_task').length,
      approvedTasks: approved.length,
      pendingReviewTasks: pendingReview.length,
      changesRequestedTasks: changesRequested.length,
      openAssignedTasks: allAssigned.length - completed.length,
      openQuickTasks: quickTasks.filter((task) => task.status !== 'done').length,
      overdueOpenTasks: overdueOpen.length,
      dueTodayTasks: dueToday.length,
      todayCompletedTasks: todayCompleted.length,
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
    currentWorkload,
    insight: {
      headline: overdueOpen.length
        ? `${overdueOpen.length} overdue task${overdueOpen.length === 1 ? '' : 's'} need follow-up.`
        : todayCompleted.length
          ? `Completed ${todayCompleted.length} task${todayCompleted.length === 1 ? '' : 's'} today.`
          : 'Current work is on track.',
      focusAreas: [
        dueToday.length ? `${dueToday.length} task${dueToday.length === 1 ? '' : 's'} are due today.` : 'No items are due today.',
        pendingReview.length ? `${pendingReview.length} completed task${pendingReview.length === 1 ? '' : 's'} are waiting for review.` : 'No items are waiting for review.',
        projects.length ? `Active in ${projects.length} project${projects.length === 1 ? '' : 's'}.` : 'No active projects assigned.',
      ],
    },
  };
}

export async function createUser({ companyId, workspaceId, actorRole, input }) {
  let tenantId = companyId;
  let targetWorkspaceId = workspaceId;
  const { User, Membership, Workspace } = await getTenantModels(companyId);
  if (!['super_admin', 'admin', 'company_admin'].includes(actorRole)) {
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

  const allowedRoles = (actorRole === 'super_admin' || actorRole === 'admin' || actorRole === 'company_admin')
    ? ['super_admin', 'admin', 'company_admin', 'manager', 'team_leader', 'team_member']
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
    canUsePrivateQuickTasks: Boolean(input.canUsePrivateQuickTasks),
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

  if (input.sendCredentialsEmail) {
    void sendTemplatedEmailSafe({
      to: email,
      templateKey: 'userCredentials',
      variables: {
        userName: user.name,
        email: user.email,
        password: input.password,
        role: user.role,
      },
    });
  }

  return user;
}

export async function importUsersBulk({ companyId, workspaceId, actorRole, rows }) {
  if (!['super_admin', 'admin', 'company_admin'].includes(actorRole)) {
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
      canUsePrivateQuickTasks: Boolean(row.canUsePrivateQuickTasks),
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
  const { User, Membership } = await getTenantModels(companyId);

  console.log('[UserService.updateUser] Attempting update:', {
    actorRole,
    userId,
    targetUserId,
    updates: JSON.stringify(updates)
  });

  if (!['super_admin', 'admin', 'company_admin'].includes(actorRole)) {
    console.warn('[UserService.updateUser] Access denied for role:', actorRole);
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

  const isAdmin = ['super_admin', 'admin', 'company_admin'].includes(actorRole);
  const allowedRoles = isAdmin
    ? ['super_admin', 'admin', 'company_admin', 'manager', 'team_leader', 'team_member']
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
  if (typeof updates.canUsePrivateQuickTasks === 'boolean') user.canUsePrivateQuickTasks = updates.canUsePrivateQuickTasks;

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

export async function setUserPassword({ companyId, actorRole, actorUserId, targetUserId, newPassword }) {
  const tenantId = companyId;
  const { User } = await getTenantModels(companyId);
  if (!['super_admin', 'admin', 'company_admin'].includes(actorRole)) {
    const err = new Error('Only company admins can update user passwords');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const user = await User.findOne({ _id: targetUserId, tenantId }).select('+passwordHash');
  if (!user) return null;

  if (String(actorUserId) === String(targetUserId)) {
    const err = new Error('Use the personal password change flow for your own account');
    err.statusCode = 400;
    err.code = 'SELF_PASSWORD_RESET_BLOCKED';
    throw err;
  }

  await assertPasswordAllowed(newPassword, { companyId: tenantId });
  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  return true;
}

export async function getUserPendingTasks({ companyId, targetUserId }) {
  const { Task, Project } = await getTenantModels(companyId);
  const tasks = await Task.find({
    tenantId: companyId,
    assigneeIds: targetUserId,
    status: { $ne: 'done' },
  }).populate('projectId', 'name color').lean();

  return tasks.map(t => ({
    id: String(t._id),
    title: t.title,
    status: t.status,
    priority: t.priority,
    projectId: String(t.projectId?._id || t.projectId),
    projectName: t.projectId?.name || 'Unknown Project',
  }));
}

export async function reassignAndDisable({ companyId, actorRole, userId, targetUserId, mappings }) {
  const tenantId = companyId;
  const { User, Membership, Task } = await getTenantModels(companyId);
  const TaskActivity = getTaskActivityModel(tenantId);

  if (!['super_admin', 'admin', 'company_admin'].includes(actorRole)) {
    const err = new Error('Only company admins can deactivate users');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (String(userId) === String(targetUserId)) {
    const err = new Error('You cannot disable your own account');
    err.statusCode = 400;
    err.code = 'SELF_DISABLE_BLOCKED';
    throw err;
  }

  const targetUser = await User.findOne({ _id: targetUserId, tenantId });
  if (!targetUser) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  // Handle reassignments
  if (Array.isArray(mappings) && mappings.length > 0) {
    for (const mapping of mappings) {
      const { taskId, newAssigneeId } = mapping;
      if (!taskId || !newAssigneeId) continue;

      const task = await Task.findOne({ _id: taskId, tenantId });
      if (!task) continue;

      const newUser = await User.findById(newAssigneeId);
      if (!newUser) continue;

      const oldAssigneeIds = task.assigneeIds.map(id => String(id));
      const nextAssigneeIds = oldAssigneeIds.filter(id => id !== String(targetUserId));
      if (!nextAssigneeIds.includes(String(newAssigneeId))) {
        nextAssigneeIds.push(String(newAssigneeId));
      }

      task.assigneeIds = nextAssigneeIds;
      await task.save();

      // Log activity (safe-wrapped to avoid blocking deactivation)
      try {
        await TaskActivity.create({
          tenantId,
          taskId: task._id,
          userId,
          action: 'ASSIGNEE_CHANGED',
          oldValue: targetUser.name,
          newValue: newUser.name,
          message: `Task reassigned from ${targetUser.name} to ${newUser.name} due to user deactivation.`,
        });
      } catch (logErr) {
        console.error('[reassignAndDisable] Logging failed:', logErr.message);
      }
    }
  }

  // Double check if any pending tasks remain
  const remainingCount = await Task.countDocuments({
    tenantId,
    assigneeIds: targetUserId,
    status: { $ne: 'done' },
  });

  if (remainingCount > 0) {
    const err = new Error(`Cannot disable user. ${remainingCount} pending tasks remain unassigned.`);
    err.statusCode = 400;
    err.code = 'TASKS_REMAINING';
    throw err;
  }

  // Final Disable
  targetUser.isActive = false;
  await targetUser.save();

  await Membership.updateMany(
    { tenantId, userId: targetUserId },
    { $set: { status: 'disabled' } }
  );

  return targetUser;
}

export async function updateMe({ companyId, userId, updates }) {
  const tenantId = companyId;
  const { User } = await getTenantModels(companyId);
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
  const { User } = await getTenantModels(companyId);

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
  const { User } = await getTenantModels(companyId);
  const user = await User.findOne({ _id: userId, tenantId }).select('+passwordHash');
  if (!user) return null;

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    const err = new Error('Current password is incorrect');
    err.statusCode = 400;
    err.code = 'BAD_PASSWORD';
    throw err;
  }

  await assertPasswordAllowed(newPassword, { companyId: tenantId });
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  return true;
}

export async function updateProfilePhoto({ companyId, userId, avatarUrl }) {
  const tenantId = companyId;
  const { User } = await getTenantModels(companyId);
  const user = await User.findOneAndUpdate(
    { _id: userId, tenantId },
    { $set: { avatar: avatarUrl } },
    { new: true }
  );
  return user;
}


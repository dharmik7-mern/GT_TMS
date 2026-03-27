import mongoose from 'mongoose';
import { getTenantModels } from '../config/tenantDb.js';
import { sendTemplatedEmailSafe } from './mail.service.js';

function strId(value) {
  return value ? String(value) : '';
}

function isPrivilegedRole(role) {
  return ['super_admin', 'admin', 'manager', 'team_leader'].includes(role);
}

function isAdminRole(role) {
  return role === 'super_admin' || role === 'admin';
}

function userHasPrivateQuickTaskAccess(user, role) {
  return isAdminRole(role) || Boolean(user?.canUsePrivateQuickTasks);
}

async function assertActorCanAssignPrivateQuickTasks({ companyId, userId, role }) {
  if (isAdminRole(role)) return;

  const { User } = await getTenantModels(companyId);
  const actor = await User.findOne({ tenantId: companyId, _id: userId })
    .select('_id role canUsePrivateQuickTasks')
    .lean();

  if (!userHasPrivateQuickTaskAccess(actor, actor?.role || role)) {
    const err = new Error('You are not enabled to assign private quick tasks');
    err.statusCode = 400;
    err.code = 'PRIVATE_QUICK_TASK_ASSIGN_PERMISSION_REQUIRED';
    throw err;
  }
}

function mapQuickTaskWithActivity(task, activityHistory) {
  const json = typeof task?.toJSON === 'function' ? task.toJSON() : task;
  return {
    ...json,
    activityHistory: Array.isArray(activityHistory) ? activityHistory : [],
  };
}

async function attachQuickTaskActivity({ companyId, workspaceId, tasks }) {
  const { ActivityLog } = await getTenantModels(companyId);
  const taskList = Array.isArray(tasks) ? tasks : [];
  if (!taskList.length) return [];

  const entityIds = taskList
    .map((task) => task?._id)
    .filter((value) => value && mongoose.Types.ObjectId.isValid(value));

  const logs = await ActivityLog.find({
    tenantId: companyId,
    workspaceId,
    entityType: 'quick_task',
    entityId: { $in: entityIds },
  }).sort({ createdAt: -1 });

  const logsByTaskId = new Map();
  for (const log of logs) {
    const key = String(log.entityId);
    const items = logsByTaskId.get(key) || [];
    items.push(log.toJSON());
    logsByTaskId.set(key, items);
  }

  return taskList.map((task) => mapQuickTaskWithActivity(task, logsByTaskId.get(String(task._id)) || []));
}

function canViewQuickTask({ role, userId, task }) {
  const uid = strId(userId);
  const isOwner =
    strId(task.reporterId) === uid ||
    strId(task.createdBy) === uid ||
    (task.assigneeIds || []).some((assigneeId) => strId(assigneeId) === uid);

  if (task.isPrivate) {
    return isAdminRole(role) || isOwner;
  }

  if (isPrivilegedRole(role)) return true;
  return isOwner;
}

function canModifyQuickTask({ role, userId, task }) {
  return canViewQuickTask({ role, userId, task });
}

function formatMailDate(value) {
  if (!value) return 'Not set';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

async function sendQuickTaskAssignmentEmails({ tenantId, assigneeIds, actorId, quickTask }) {
  const uniqueAssigneeIds = Array.from(new Set((assigneeIds || []).map(String))).filter(Boolean);
  if (!uniqueAssigneeIds.length) return;

  const { User } = await getTenantModels(tenantId);
  const [users, actor] = await Promise.all([
    User.find({ tenantId, _id: { $in: uniqueAssigneeIds } }).select('name email').lean(),
    actorId ? User.findOne({ tenantId, _id: actorId }).select('name email').lean() : Promise.resolve(null),
  ]);

  await Promise.allSettled(
    users
      .filter((user) => user?.email)
      .map((user) =>
        sendTemplatedEmailSafe({
          to: user.email,
          templateKey: 'quickTaskAssigned',
          variables: {
            userName: user.name || 'User',
            taskTitle: quickTask.title,
            priority: quickTask.priority || 'medium',
            dueDate: formatMailDate(quickTask.dueDate),
            assignedBy: actor?.name || 'Administrator',
            taskUrl: `/quick-tasks/${quickTask._id}`,
          },
        })
      )
  );
}

function buildDefaultCompletionReview() {
  return {
    completedAt: null,
    completedBy: null,
    completionRemark: '',
    reviewStatus: 'pending',
    rating: null,
    reviewRemark: '',
    reviewedAt: null,
    reviewedBy: null,
  };
}

function normalizeAssigneeIds(data) {
  if (Array.isArray(data?.assigneeIds)) return data.assigneeIds.filter(Boolean);
  if (data?.assigneeId) return [data.assigneeId];
  return [];
}

function normalizeUserIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUserName(value) {
  return normalizeUserIdentifier(value).replace(/\s+/g, ' ');
}

async function buildUserDirectory(companyId) {
  const { User } = await getTenantModels(companyId);
  const users = await User.find({ tenantId: companyId, isActive: true })
    .select('_id email name employeeId')
    .lean();

  const byEmail = new Map();
  const byEmployeeId = new Map();
  const byName = new Map();

  for (const user of users) {
    const userId = String(user._id);
    const email = normalizeUserIdentifier(user.email);
    const employeeId = normalizeUserIdentifier(user.employeeId);
    const name = normalizeUserName(user.name);

    if (email) byEmail.set(email, userId);
    if (employeeId) byEmployeeId.set(employeeId, userId);
    if (name) {
      const items = byName.get(name) || [];
      items.push({ id: userId, name: user.name, email: user.email, employeeId: user.employeeId || '' });
      byName.set(name, items);
    }
  }

  return { byEmail, byEmployeeId, byName };
}

function resolveIdentifierFromDirectory(identifier, directory, fieldLabel) {
  const normalized = normalizeUserIdentifier(identifier);
  if (!normalized) return null;

  if (directory.byEmail.has(normalized)) return directory.byEmail.get(normalized);
  if (directory.byEmployeeId.has(normalized)) return directory.byEmployeeId.get(normalized);

  const normalizedName = normalizeUserName(identifier);
  const nameMatches = directory.byName.get(normalizedName) || [];
  if (nameMatches.length === 1) return nameMatches[0].id;

  if (nameMatches.length > 1) {
    const err = new Error(`${fieldLabel} is ambiguous for "${identifier}". Multiple users share that name.`);
    err.statusCode = 400;
    err.code = 'USER_LOOKUP_AMBIGUOUS';
    throw err;
  }

  const err = new Error(`${fieldLabel} not found for "${identifier}". Match by full name, email, or employee ID.`);
  err.statusCode = 400;
  err.code = 'USER_LOOKUP_NOT_FOUND';
  throw err;
}

async function resolveUserIdsFromIdentifiers({ companyId, identifiers, fieldLabel }) {
  const normalizedIdentifiers = Array.from(
    new Set(
      (Array.isArray(identifiers) ? identifiers : [])
        .map((identifier) => String(identifier || '').trim())
        .filter(Boolean)
    )
  );

  if (!normalizedIdentifiers.length) return [];
  const directory = await buildUserDirectory(companyId);
  return normalizedIdentifiers.map((identifier) => resolveIdentifierFromDirectory(identifier, directory, fieldLabel)).filter(Boolean);
}

async function resolveSingleUserIdFromIdentifier({ companyId, identifier, fieldLabel }) {
  const values = await resolveUserIdsFromIdentifiers({ companyId, identifiers: [identifier], fieldLabel });
  return values[0] || null;
}

export async function listQuickTasks({ companyId, workspaceId, userId, role }) {
  const tenantId = companyId;
  const { QuickTask } = await getTenantModels(companyId);

  const filter = { tenantId, workspaceId };
  if (isAdminRole(role)) {
    // admins can see all quick tasks
  } else if (role === 'manager') {
    filter.$or = [
      { isPrivate: false },
      { isPrivate: { $exists: false } },
      { assigneeIds: userId },
      { reporterId: userId },
      { createdBy: userId },
    ];
  } else {
    filter.$or = [
      { assigneeIds: userId },
      { reporterId: userId },
      { createdBy: userId },
    ];
  }

  const tasks = await QuickTask.find(filter).sort({ updatedAt: -1 });
  return attachQuickTaskActivity({ companyId, workspaceId, tasks });
}

export async function createQuickTask({ companyId, workspaceId, userId, data, role }) {
  const tenantId = companyId;
  const { QuickTask, ActivityLog, Notification } = await getTenantModels(companyId);

  const assigneeIds = normalizeAssigneeIds(data);
  const reporterId = data.reporterId || userId;
  const migrationMode = Boolean(data.migrationMode);
  const primaryAssigneeId = assigneeIds.length === 1 ? assigneeIds[0] : null;
  const isSelfAssigned =
    primaryAssigneeId &&
    strId(primaryAssigneeId) === strId(reporterId) &&
    assigneeIds.length === 1;

  const isPrivate = Boolean(data.isPrivate);

  if (isPrivate) {
    await assertActorCanAssignPrivateQuickTasks({ companyId, userId, role });
  }

  let quickTask = await QuickTask.create({
    tenantId,
    workspaceId,
    title: data.title,
    description: data.description,
    status: data.status || 'todo',
    priority: data.priority || 'medium',
    assigneeIds,
    reporterId,
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    isPrivate,
    createdBy: reporterId,
    assignedTo: primaryAssigneeId,
  });

  if (data.createdAt || data.updatedAt) {
    await QuickTask.updateOne(
      { _id: quickTask._id },
      {
        $set: {
          ...(data.createdAt ? { createdAt: new Date(data.createdAt) } : {}),
          ...(data.updatedAt ? { updatedAt: new Date(data.updatedAt) } : {}),
        },
      },
      { timestamps: false }
    );
    quickTask = await QuickTask.findById(quickTask._id);
  }

  if (!migrationMode) {
    await ActivityLog.create({
      tenantId,
      workspaceId,
      userId,
      type: 'quick_task_created',
      description: `Created quick task "${quickTask.title}"`,
      entityType: 'quick_task',
      entityId: quickTask._id,
      metadata: {},
    });
  }

  if (!migrationMode && assigneeIds.length) {
    await Notification.insertMany(
      assigneeIds.map((assigneeId) => ({
        tenantId,
        workspaceId,
        userId: assigneeId,
        type: 'task_assigned',
        title: 'Task assigned to you',
        message: `You were assigned quick task "${quickTask.title}"`,
        isRead: false,
        relatedId: String(quickTask._id),
      }))
    );
    await sendQuickTaskAssignmentEmails({
      tenantId,
      assigneeIds,
      actorId: userId,
      quickTask,
    });
  }

  return (await attachQuickTaskActivity({ companyId, workspaceId, tasks: [quickTask] }))[0];
}

export async function importQuickTasksBulk({ companyId, workspaceId, userId, actorRole, rows }) {
  if (!['super_admin', 'admin', 'manager', 'team_leader'].includes(actorRole)) {
    const err = new Error('Only admins, managers, or team leaders can import quick tasks');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const normalizedRows = Array.isArray(rows) ? rows : [];
  if (!normalizedRows.length) {
    const err = new Error('No quick tasks provided for import');
    err.statusCode = 400;
    err.code = 'IMPORT_EMPTY';
    throw err;
  }

  const createdTasks = [];
  const failures = [];

  for (let index = 0; index < normalizedRows.length; index += 1) {
    const row = normalizedRows[index] || {};
    const rowNumber = Number(row.rowNumber) > 0 ? Number(row.rowNumber) : index + 2;
    const assigneeIdentifiers = [
      ...String(row.assigneeEmails ?? '').split(/[;,]/).map((item) => item.trim()).filter(Boolean),
      ...String(row.assigneeNames ?? '').split(/[;,]/).map((item) => item.trim()).filter(Boolean),
    ];

    try {
      const assigneeIds = await resolveUserIdsFromIdentifiers({
        companyId,
        identifiers: assigneeIdentifiers,
        fieldLabel: 'Assignees',
      });
      const reporterIdentifier = row.reporterEmail || row.reporterName;
      const reporterId = reporterIdentifier
        ? await resolveSingleUserIdFromIdentifier({ companyId, identifier: reporterIdentifier, fieldLabel: 'Reporter' })
        : userId;

      const task = await createQuickTask({
        companyId,
        workspaceId,
        userId,
        role: actorRole,
        data: {
          title: String(row.title ?? '').trim(),
          description: String(row.description ?? '').trim(),
          priority: row.priority,
          status: row.status,
          dueDate: row.dueDate ? String(row.dueDate).trim() : undefined,
          reporterId,
          createdAt: row.createdAt ? String(row.createdAt).trim() : undefined,
          updatedAt: row.updatedAt ? String(row.updatedAt).trim() : undefined,
          migrationMode: true,
          assigneeIds,
        },
      });
      createdTasks.push(task);
    } catch (error) {
      failures.push({
        rowNumber,
        title: String(row.title ?? '').trim(),
        assigneeEmails: `${String(row.assigneeEmails ?? '').trim()} ${String(row.assigneeNames ?? '').trim()}`.trim(),
        message: error?.message || 'Failed to import quick task',
        code: error?.code || 'IMPORT_FAILED',
      });
    }
  }

  return {
    totalRows: normalizedRows.length,
    createdCount: createdTasks.length,
    failedCount: failures.length,
    createdTasks,
    failures,
  };
}

export async function updateQuickTask({ companyId, workspaceId, userId, role, id, updates }) {
  const tenantId = companyId;
  const { QuickTask, ActivityLog, Notification } = await getTenantModels(companyId);

  const existing = await QuickTask.findOne({ _id: id, tenantId, workspaceId });
  if (!existing) return null;

  if (!canModifyQuickTask({ role, userId, task: existing })) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const beforeAssignees = (existing.assigneeIds || []).map(String);
  const assigneeIds = normalizeAssigneeIds(updates);
  const assigneeIdsProvided = updates.assigneeIds !== undefined || updates.assigneeId !== undefined;
  const previousStatus = existing.status;
  const nextStatus = updates.status ?? existing.status;
  const previousPriority = existing.priority;
  const previousDueDate = existing.dueDate ? new Date(existing.dueDate).toISOString().split('T')[0] : null;
  const nextDueDate = updates.dueDate !== undefined
    ? (updates.dueDate ? new Date(updates.dueDate).toISOString().split('T')[0] : null)
    : previousDueDate;
  const currentReview = existing.completionReview || {};
  const previousCompletionRemark = currentReview.completionRemark || '';
  const nextCompletionRemark = updates.completionRemark !== undefined
    ? (updates.completionRemark || '')
    : previousCompletionRemark;

  const $set = {
    ...updates,
    ...(updates.dueDate !== undefined ? { dueDate: updates.dueDate ? new Date(updates.dueDate) : null } : {}),
  };

  delete $set.assigneeId;

  const currentAssigneeIds = assigneeIdsProvided ? assigneeIds : (existing.assigneeIds || []).map(String);
  const primaryAssigneeId = currentAssigneeIds.length === 1 ? currentAssigneeIds[0] : null;

  if (assigneeIdsProvided) {
    $set.assigneeIds = currentAssigneeIds;
    $set.assignedTo = primaryAssigneeId;
  }

  const nextIsPrivate = updates.isPrivate !== undefined ? Boolean(updates.isPrivate) : Boolean(existing.isPrivate);
  if (updates.isPrivate !== undefined) {
    $set.isPrivate = nextIsPrivate;
  }

  if (updates.isPrivate === true) {
    await assertActorCanAssignPrivateQuickTasks({ companyId, userId, role });
  }

  if (updates.completionRemark !== undefined || updates.status !== undefined) {
    const movedToDone = previousStatus !== 'done' && nextStatus === 'done';
    const movedAwayFromDone = previousStatus === 'done' && nextStatus !== 'done';

    if (movedAwayFromDone) {
      $set.completionReview = buildDefaultCompletionReview();
    } else {
      $set.completionReview = {
        completedAt: movedToDone ? new Date() : (currentReview.completedAt || null),
        completedBy: movedToDone ? userId : (currentReview.completedBy || null),
        completionRemark: nextCompletionRemark,
        reviewStatus: movedToDone ? 'pending' : (currentReview.reviewStatus || 'pending'),
        rating: movedToDone ? null : (typeof currentReview.rating === 'number' ? currentReview.rating : null),
        reviewRemark: movedToDone ? '' : (currentReview.reviewRemark || ''),
        reviewedAt: movedToDone ? null : (currentReview.reviewedAt || null),
        reviewedBy: movedToDone ? null : (currentReview.reviewedBy || null),
      };
    }
  }

  const quickTask = await QuickTask.findOneAndUpdate(
    { _id: id, tenantId, workspaceId },
    { $set },
    { new: true }
  );
  if (!quickTask) return null;

  const activityEntries = [{
    tenantId,
    workspaceId,
    userId,
    type: 'quick_task_updated',
    description: `Updated quick task "${quickTask.title}"`,
    entityType: 'quick_task',
    entityId: quickTask._id,
    metadata: { changedFields: Object.keys(updates || {}) },
  }];

  if (previousStatus !== quickTask.status) {
    activityEntries.push({
      tenantId,
      workspaceId,
      userId,
      type: 'quick_task_status_changed',
      description: `Changed status for "${quickTask.title}" from "${previousStatus}" to "${quickTask.status}"`,
      entityType: 'quick_task',
      entityId: quickTask._id,
      metadata: { from: previousStatus, to: quickTask.status },
    });
  }

  if (previousPriority !== quickTask.priority) {
    activityEntries.push({
      tenantId,
      workspaceId,
      userId,
      type: 'quick_task_priority_changed',
      description: `Changed priority for "${quickTask.title}" from "${previousPriority}" to "${quickTask.priority}"`,
      entityType: 'quick_task',
      entityId: quickTask._id,
      metadata: { from: previousPriority, to: quickTask.priority },
    });
  }

  if (previousDueDate !== nextDueDate) {
    activityEntries.push({
      tenantId,
      workspaceId,
      userId,
      type: 'quick_task_due_date_changed',
      description: nextDueDate
        ? `Set due date for "${quickTask.title}" to ${nextDueDate}`
        : `Cleared due date for "${quickTask.title}"`,
      entityType: 'quick_task',
      entityId: quickTask._id,
      metadata: { from: previousDueDate, to: nextDueDate },
    });
  }

  if (previousCompletionRemark !== nextCompletionRemark) {
    activityEntries.push({
      tenantId,
      workspaceId,
      userId,
      type: 'quick_task_completion_remark_updated',
      description: `Updated completion remark for "${quickTask.title}"`,
      entityType: 'quick_task',
      entityId: quickTask._id,
      metadata: { remark: nextCompletionRemark },
    });
  }

  const afterAssignees = (quickTask.assigneeIds || []).map(String);
  if (beforeAssignees.join(',') !== afterAssignees.join(',')) {
    activityEntries.push({
      tenantId,
      workspaceId,
      userId,
      type: 'quick_task_assignees_changed',
      description: `Updated assignees for "${quickTask.title}"`,
      entityType: 'quick_task',
      entityId: quickTask._id,
      metadata: { from: beforeAssignees, to: afterAssignees },
    });
  }

  await ActivityLog.insertMany(activityEntries);

  const newlyAssigned = afterAssignees.filter((assigneeId) => !beforeAssignees.includes(assigneeId));
  if (newlyAssigned.length) {
    await Notification.insertMany(
      newlyAssigned.map((assigneeId) => ({
        tenantId,
        workspaceId,
        userId: assigneeId,
        type: 'task_assigned',
        title: 'Task assigned to you',
        message: `You were assigned quick task "${quickTask.title}"`,
        isRead: false,
        relatedId: String(quickTask._id),
      }))
    );
    await sendQuickTaskAssignmentEmails({
      tenantId,
      assigneeIds: newlyAssigned,
      actorId: userId,
      quickTask,
    });
  }

  if (previousStatus !== 'done' && quickTask.status === 'done') {
    const reviewerIds = Array.from(new Set([strId(quickTask.reporterId)])).filter((reviewerId) => reviewerId && reviewerId !== strId(userId));
    if (reviewerIds.length) {
      await Notification.insertMany(
        reviewerIds.map((reviewerId) => ({
          tenantId,
          workspaceId,
          userId: reviewerId,
          type: 'project_update',
          title: 'Quick task completed and awaiting review',
          message: `"${quickTask.title}" was marked complete and needs review.`,
          isRead: false,
          relatedId: String(quickTask._id),
        }))
      );
    }
  }

  return (await attachQuickTaskActivity({ companyId, workspaceId, tasks: [quickTask] }))[0];
}

export async function reviewQuickTask({ companyId, workspaceId, userId, role, id, action, reviewRemark, rating }) {
  const tenantId = companyId;
  const { QuickTask, ActivityLog, Notification } = await getTenantModels(companyId);
  const quickTask = await QuickTask.findOne({ _id: id, tenantId, workspaceId });
  if (!quickTask) return null;

  const uid = strId(userId);
  const canReview = isPrivilegedRole(role) || strId(quickTask.reporterId) === uid;
  if (!canReview) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (quickTask.status !== 'done') {
    const err = new Error('Only completed quick tasks can be reviewed');
    err.statusCode = 400;
    err.code = 'INVALID_STATE';
    throw err;
  }

  if (action === 'approve' && !(typeof rating === 'number' && rating >= 1 && rating <= 5)) {
    const err = new Error('A rating between 1 and 5 is required to approve a completed quick task');
    err.statusCode = 400;
    err.code = 'RATING_REQUIRED';
    throw err;
  }

  quickTask.completionReview = {
    ...(quickTask.completionReview?.toObject?.() || quickTask.completionReview || {}),
    reviewStatus: action === 'approve' ? 'approved' : 'changes_requested',
    rating: action === 'approve' ? rating : null,
    reviewRemark: reviewRemark || '',
    reviewedAt: new Date(),
    reviewedBy: userId,
  };

  if (action === 'changes_requested') {
    quickTask.status = 'in_progress';
  }

  await quickTask.save();

  await ActivityLog.create({
    tenantId,
    workspaceId,
    userId,
    type: action === 'approve' ? 'quick_task_review_approved' : 'quick_task_review_changes_requested',
    description: action === 'approve'
      ? `Approved completed quick task "${quickTask.title}"`
      : `Requested changes for completed quick task "${quickTask.title}"`,
    entityType: 'quick_task',
    entityId: quickTask._id,
    metadata: {
      action,
      rating: action === 'approve' ? rating : null,
      reviewRemark: reviewRemark || '',
    },
  });

  const notifyUserIds = Array.from(
    new Set([
      ...(quickTask.assigneeIds || []).map((assigneeId) => strId(assigneeId)),
      strId(quickTask.reporterId),
    ])
  ).filter((notifyId) => notifyId && notifyId !== uid);

  if (notifyUserIds.length) {
    await Notification.insertMany(
      notifyUserIds.map((notifyUserId) => ({
        tenantId,
        workspaceId,
        userId: notifyUserId,
        type: 'project_update',
        title: action === 'approve' ? 'Quick task review approved' : 'Quick task changes requested',
        message: action === 'approve'
          ? `Review approved for "${quickTask.title}".`
          : `Changes were requested for "${quickTask.title}".`,
        isRead: false,
        relatedId: String(quickTask._id),
      }))
    );
  }

  return (await attachQuickTaskActivity({ companyId, workspaceId, tasks: [quickTask] }))[0];
}

export async function deleteQuickTask({ companyId, workspaceId, userId, role, id }) {
  const tenantId = companyId;
  const { QuickTask, ActivityLog } = await getTenantModels(companyId);
  const existing = await QuickTask.findOne({ _id: id, tenantId, workspaceId });
  if (!existing) return null;

  const canDelete =
    isPrivilegedRole(role) ||
    strId(existing.reporterId) === strId(userId) ||
    strId(existing.createdBy) === strId(userId);

  if (!canDelete) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const quickTask = await QuickTask.findOneAndDelete({ _id: id, tenantId, workspaceId });
  if (!quickTask) return null;

  await ActivityLog.create({
    tenantId,
    workspaceId,
    userId,
    type: 'quick_task_deleted',
    description: `Deleted quick task "${quickTask.title}"`,
    entityType: 'quick_task',
    entityId: quickTask._id,
    metadata: {},
  });

  return quickTask;
}

export async function addQuickTaskComment({ companyId, workspaceId, userId, role, taskId, content }) {
  const tenantId = companyId;
  const { QuickTask, Notification, ActivityLog } = await getTenantModels(companyId);

  const quickTask = await QuickTask.findOne({ _id: taskId, tenantId, workspaceId });
  if (!quickTask) return null;

  if (!canViewQuickTask({ role, userId, task: quickTask })) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const comment = {
    content,
    authorId: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await QuickTask.updateOne({ _id: taskId, tenantId, workspaceId }, { $push: { comments: comment } });
  const updated = await QuickTask.findOne({ _id: taskId, tenantId, workspaceId });

  await ActivityLog.create({
    tenantId,
    workspaceId,
    userId,
    type: 'quick_task_comment_added',
    description: `Added a comment to "${updated?.title || 'quick task'}"`,
    entityType: 'quick_task',
    entityId: updated?._id || taskId,
    metadata: { content },
  });

  const uid = strId(userId);
  const notifyUserIds = Array.from(
    new Set([
      ...((updated?.assigneeIds || []).map((assigneeId) => strId(assigneeId)) || []),
      strId(updated?.reporterId),
    ])
  ).filter((id) => id && id !== uid);

  if (notifyUserIds.length) {
    await Notification.insertMany(
      notifyUserIds.map((notifyUserId) => ({
        tenantId,
        workspaceId,
        userId: notifyUserId,
        type: 'comment_added',
        title: 'New comment on quick task',
        message: `New comment on "${updated?.title || 'quick task'}"`,
        isRead: false,
        relatedId: String(updated?._id),
      }))
    );
  }

  return (await attachQuickTaskActivity({ companyId, workspaceId, tasks: updated ? [updated] : [] }))[0] || null;
}

export async function addQuickTaskAttachments({ companyId, workspaceId, userId, role, taskId, files, requestBaseUrl }) {
  const tenantId = companyId;
  const { QuickTask, ActivityLog } = await getTenantModels(companyId);

  const quickTask = await QuickTask.findOne({ _id: taskId, tenantId, workspaceId });
  if (!quickTask) return null;

  if (!canModifyQuickTask({ role, userId, task: quickTask })) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const attachments = (files || []).map((file) => ({
    name: file.originalname,
    url: `${requestBaseUrl}/uploads/${file.filename}`,
    size: file.size,
    type: file.mimetype,
    uploadedBy: userId,
  }));

  await QuickTask.updateOne({ _id: taskId, tenantId, workspaceId }, { $push: { attachments } });
  const updated = await QuickTask.findOne({ _id: taskId, tenantId, workspaceId });

  if (attachments.length) {
    await ActivityLog.create({
      tenantId,
      workspaceId,
      userId,
      type: 'quick_task_attachments_added',
      description: `Added ${attachments.length} attachment${attachments.length === 1 ? '' : 's'} to "${updated?.title || 'quick task'}"`,
      entityType: 'quick_task',
      entityId: updated?._id || taskId,
      metadata: {
        attachments: attachments.map((attachment) => ({
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
        })),
      },
    });
  }

  return (await attachQuickTaskActivity({ companyId, workspaceId, tasks: updated ? [updated] : [] }))[0] || null;
}

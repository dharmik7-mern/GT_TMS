import { getTenantModels } from '../config/tenantDb.js';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

const DEBUG_LOG_FILE = path.join(process.cwd(), 'debug-e243b9.log');
function fileAgentLog(payload) {
  try {
    fs.appendFileSync(DEBUG_LOG_FILE, JSON.stringify(payload) + '\n');
  } catch {
    // ignore logging errors
  }
}

export async function listQuickTasks({ companyId, workspaceId, userId, role }) {
  const tenantId = companyId;
  const { QuickTask } = await getTenantModels(companyId);

  const filter = { tenantId, workspaceId };

  if (role !== 'admin' && role !== 'super_admin') {
    filter.$or = [
      { isPrivate: false },
      { isPrivate: { $exists: false } },
      { $and: [{ isPrivate: true }, { createdBy: userId }] },
      { $and: [{ isPrivate: true }, { reporterId: userId }] },
    ];
  }

  const tasks = await QuickTask.find(filter).sort({ updatedAt: -1 });
  return attachQuickTaskActivity({ companyId, workspaceId, tasks });
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

  if (!taskList.length) {
    return [];
  }

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

  return taskList.map((task) =>
    mapQuickTaskWithActivity(task, logsByTaskId.get(String(task._id)) || [])
  );
}

  export async function createQuickTask({ companyId, workspaceId, userId, data }) {
    const tenantId = companyId;
    const { QuickTask, ActivityLog, Notification } = await getTenantModels(companyId);

    // #region agent log
    fetch('http://127.0.0.1:7462/ingest/1ea124be-0e11-4062-90a0-e3d9902964d6', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e243b9' }, body: JSON.stringify({ sessionId: 'e243b9', runId: 'pre-fix', hypothesisId: 'H1', location: 'server/src/services/quickTask.service.js:createQuickTask', message: 'Creating quick task in DB', data: { tenantId: String(tenantId), workspaceId: String(workspaceId), reporterId: String(userId), assigneeIdsCount: Array.isArray(data?.assigneeIds) ? data.assigneeIds.length : undefined, assigneeIdProvided: !!data?.assigneeId, status: data?.status, priority: data?.priority }, timestamp: Date.now() }) }).catch(() => { });
    fileAgentLog({ sessionId: 'e243b9', runId: 'pre-fix', hypothesisId: 'H1', location: 'server/src/services/quickTask.service.js:createQuickTask', message: 'Creating quick task in DB', data: { tenantId: String(tenantId), workspaceId: String(workspaceId), reporterId: String(userId), assigneeIdsCount: Array.isArray(data?.assigneeIds) ? data.assigneeIds.length : undefined, assigneeIdProvided: !!data?.assigneeId, status: data?.status, priority: data?.priority }, timestamp: Date.now() });
    // #endregion

    const assigneeIds = Array.isArray(data.assigneeIds)
      ? data.assigneeIds
      : data.assigneeId
        ? [data.assigneeId]
        : [];

    const reporterId = data.reporterId || userId;
    const migrationMode = Boolean(data.migrationMode);

    const primaryAssigneeId = assigneeIds.length === 1 ? assigneeIds[0] : null;

    // Private should only be enabled when the UI explicitly turns it on.
    // Still enforce: if assigned to someone else (or multiple people), it cannot be private.
    let isPrivate = data.isPrivate !== undefined ? Boolean(data.isPrivate) : false;
    const isSelfAssigned =
      primaryAssigneeId && String(primaryAssigneeId) === String(reporterId) && assigneeIds.length === 1;
    if (assigneeIds.length > 0 && !isSelfAssigned) {
      isPrivate = false;
    }

    let qt = await QuickTask.create({
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
        { _id: qt._id },
        {
          $set: {
            ...(data.createdAt ? { createdAt: new Date(data.createdAt) } : {}),
            ...(data.updatedAt ? { updatedAt: new Date(data.updatedAt) } : {}),
          },
        },
        { timestamps: false }
      );
      qt = await QuickTask.findById(qt._id);
    }

    if (!migrationMode) {
      await ActivityLog.create({
        tenantId,
        workspaceId,
        userId,
        type: 'quick_task_created',
        description: `Created quick task "${qt.title}"`,
        entityType: 'quick_task',
        entityId: qt._id,
        metadata: {},
      });
    }

    if (!migrationMode && assigneeIds.length) {
      await Notification.insertMany(
        assigneeIds.map((assignee) => ({
          tenantId,
          workspaceId,
          userId: assignee,
          type: 'task_assigned',
          title: 'Task assigned to you',
          message: `You were assigned quick task "${qt.title}"`,
          isRead: false,
          relatedId: String(qt._id),
        }))
      );
    }

    return qt;
  }

  async function resolveAssigneeIdsFromEmails({ companyId, emails }) {
    return resolveUserIdsFromIdentifiers({ companyId, identifiers: emails, fieldLabel: 'Assignees' });
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

    if (directory.byEmail.has(normalized)) {
      return directory.byEmail.get(normalized);
    }

    if (directory.byEmployeeId.has(normalized)) {
      return directory.byEmployeeId.get(normalized);
    }

    const normalizedName = normalizeUserName(identifier);
    const nameMatches = directory.byName.get(normalizedName) || [];
    if (nameMatches.length === 1) {
      return nameMatches[0].id;
    }

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

    if (!normalizedIdentifiers.length) {
      return [];
    }

    const directory = await buildUserDirectory(companyId);
    return normalizedIdentifiers.map((identifier) => resolveIdentifierFromDirectory(identifier, directory, fieldLabel)).filter(Boolean);
  }

  async function resolveSingleUserIdFromIdentifier({ companyId, identifier, fieldLabel }) {
    const values = await resolveUserIdsFromIdentifiers({ companyId, identifiers: [identifier], fieldLabel });
    return values[0] || null;
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
        ...String(row.assigneeEmails ?? '')
          .split(/[;,]/)
          .map((item) => item.trim())
          .filter(Boolean),
        ...String(row.assigneeNames ?? '')
          .split(/[;,]/)
          .map((item) => item.trim())
          .filter(Boolean),
      ];

      try {
        const assigneeIds = await resolveUserIdsFromIdentifiers({ companyId, identifiers: assigneeIdentifiers, fieldLabel: 'Assignees' });
        const reporterIdentifier = row.reporterEmail || row.reporterName;
        const reporterId = reporterIdentifier
          ? await resolveSingleUserIdFromIdentifier({ companyId, identifier: reporterIdentifier, fieldLabel: 'Reporter' })
          : userId;
        const task = await createQuickTask({
          companyId,
          workspaceId,
          userId,
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

  export async function updateQuickTask({ companyId, workspaceId, userId, id, updates }) {
    const tenantId = companyId;
    const { QuickTask, ActivityLog, Notification } = await getTenantModels(companyId);

    const existing = await QuickTask.findOne({ _id: id, tenantId, workspaceId });
    if (!existing) return null;

    const beforeAssignees = existing.assigneeIds || [];

    const assigneeIds =
      updates.assigneeIds !== undefined
        ? updates.assigneeIds
        : updates.assigneeId !== undefined
          ? [updates.assigneeId]
          : undefined;

    const previousStatus = existing.status;
    const nextStatus = updates.status ?? existing.status;
    const previousPriority = existing.priority;
    const previousDueDate = existing.dueDate ? new Date(existing.dueDate).toISOString().split('T')[0] : null;
    const nextDueDate = updates.dueDate !== undefined
      ? (updates.dueDate ? new Date(updates.dueDate).toISOString().split('T')[0] : null)
      : previousDueDate;
    const currentReview = existing.completionReview || {};
    const nextCompletionRemark =
      updates.completionRemark !== undefined
        ? (updates.completionRemark || '')
        : (currentReview.completionRemark || '');
    const previousCompletionRemark = currentReview.completionRemark || '';

    const $set = {
      ...updates,
      ...(updates.dueDate !== undefined ? { dueDate: updates.dueDate ? new Date(updates.dueDate) : null } : {}),
    };

    const currentAssigneeIds = assigneeIds !== undefined ? assigneeIds : (existing.assigneeIds || []);
    const primaryAssigneeId = currentAssigneeIds.length === 1 ? currentAssigneeIds[0] : null;

    if (assigneeIds !== undefined) {
      $set.assigneeIds = assigneeIds;
      delete $set.assigneeId;
      $set.assignedTo = primaryAssigneeId;
    }

    // Rule: If assigned to someone else (who is not the reporter), it cannot be private.
    // Otherwise, respect the toggle only when explicitly provided.
    const isSelfAssigned =
      primaryAssigneeId && String(primaryAssigneeId) === String(existing.reporterId) && currentAssigneeIds.length === 1;
    if (currentAssigneeIds.length > 0 && !isSelfAssigned) {
      $set.isPrivate = false;
    } else if (updates.isPrivate !== undefined) {
      $set.isPrivate = Boolean(updates.isPrivate);
    }

    if (updates.completionRemark !== undefined || updates.status !== undefined) {
      const current = existing.completionReview || {};
      const movedToDone = previousStatus !== 'done' && nextStatus === 'done';
      const movedAwayFromDone = previousStatus === 'done' && nextStatus !== 'done';

      if (movedAwayFromDone) {
        $set.completionReview = {
          completedAt: null,
          completedBy: null,
          completionRemark: '',
          reviewStatus: 'pending',
          rating: null,
          reviewRemark: '',
          reviewedAt: null,
          reviewedBy: null,
        };
      } else {
        $set.completionReview = {
          completedAt: movedToDone ? new Date() : (current.completedAt || null),
          completedBy: movedToDone ? userId : (current.completedBy || null),
          completionRemark: updates.completionRemark !== undefined ? (updates.completionRemark || '') : (current.completionRemark || ''),
          reviewStatus: movedToDone ? 'pending' : (current.reviewStatus || 'pending'),
          rating: movedToDone ? null : (typeof current.rating === 'number' ? current.rating : null),
          reviewRemark: movedToDone ? '' : (current.reviewRemark || ''),
          reviewedAt: movedToDone ? null : (current.reviewedAt || null),
          reviewedBy: movedToDone ? null : (current.reviewedBy || null),
        };
      }
    }

    const qt = await QuickTask.findOneAndUpdate({ _id: id, tenantId, workspaceId }, { $set }, { new: true });
    if (!qt) return null;

    const activityEntries = [{
      tenantId,
      workspaceId,
      userId,
      type: 'quick_task_updated',
      description: `Updated quick task "${qt.title}"`,
      entityType: 'quick_task',
      entityId: qt._id,
      metadata: {
        changedFields: Object.keys(updates || {}),
      },
    }];

    if (previousStatus !== qt.status) {
      activityEntries.push({
        tenantId,
        workspaceId,
        userId,
        type: 'quick_task_status_changed',
        description: `Changed status for "${qt.title}" from "${previousStatus}" to "${qt.status}"`,
        entityType: 'quick_task',
        entityId: qt._id,
        metadata: {
          from: previousStatus,
          to: qt.status,
        },
      });
    }

    if (previousPriority !== qt.priority) {
      activityEntries.push({
        tenantId,
        workspaceId,
        userId,
        type: 'quick_task_priority_changed',
        description: `Changed priority for "${qt.title}" from "${previousPriority}" to "${qt.priority}"`,
        entityType: 'quick_task',
        entityId: qt._id,
        metadata: {
          from: previousPriority,
          to: qt.priority,
        },
      });
    }

    if (previousDueDate !== nextDueDate) {
      activityEntries.push({
        tenantId,
        workspaceId,
        userId,
        type: 'quick_task_due_date_changed',
        description: nextDueDate
          ? `Set due date for "${qt.title}" to ${nextDueDate}`
          : `Cleared due date for "${qt.title}"`,
        entityType: 'quick_task',
        entityId: qt._id,
        metadata: {
          from: previousDueDate,
          to: nextDueDate,
        },
      });
    }

    if (previousCompletionRemark !== nextCompletionRemark) {
      activityEntries.push({
        tenantId,
        workspaceId,
        userId,
        type: 'quick_task_completion_remark_updated',
        description: `Updated completion remark for "${qt.title}"`,
        entityType: 'quick_task',
        entityId: qt._id,
        metadata: {
          remark: nextCompletionRemark,
        },
      });
    }

    if (assigneeIds !== undefined) {
      const before = beforeAssignees.map(String).sort();
      const after = assigneeIds.map(String).sort();
      if (before.join(',') !== after.join(',')) {
        activityEntries.push({
          tenantId,
          workspaceId,
          userId,
          type: 'quick_task_assignees_changed',
          description: `Updated assignees for "${qt.title}"`,
          entityType: 'quick_task',
          entityId: qt._id,
          metadata: {
            from: before,
            to: after,
          },
        });
      }
    }

    await ActivityLog.insertMany(activityEntries);

    if (assigneeIds !== undefined && assigneeIds.length) {
      const newlyAssigned = assigneeIds.filter((a) => !beforeAssignees.map(String).includes(String(a)));
      if (newlyAssigned.length) {
        await Notification.insertMany(
          newlyAssigned.map((assignee) => ({
            tenantId,
            workspaceId,
            userId: assignee,
            type: 'task_assigned',
            title: 'Task assigned to you',
            message: `You were assigned quick task "${qt.title}"`,
            isRead: false,
            relatedId: String(qt._id),
          }))
        );
      }
    }

    if (previousStatus !== 'done' && qt.status === 'done') {
      const reviewerIds = Array.from(new Set([
        String(qt.reporterId),
      ])).filter((reviewerId) => reviewerId !== String(userId));

      if (reviewerIds.length) {
        await Notification.insertMany(
          reviewerIds.map((reviewerId) => ({
            tenantId,
            workspaceId,
            userId: reviewerId,
            type: 'project_update',
            title: 'Quick task completed and awaiting review',
            message: `"${qt.title}" was marked complete and needs review.`,
            isRead: false,
            relatedId: String(qt._id),
          }))
        );
      }
    }

    return mapQuickTaskWithActivity(qt, activityEntries.map((entry) => ({
      ...entry,
      id: `local-${Math.random().toString(36).slice(2)}`,
      entityId: String(qt._id),
      userId: String(entry.userId),
      createdAt: new Date().toISOString(),
    })));
  }

  export async function reviewQuickTask({ companyId, workspaceId, userId, role, id, action, reviewRemark, rating }) {
    const tenantId = companyId;
    const { QuickTask, ActivityLog, Notification } = await getTenantModels(companyId);
    const qt = await QuickTask.findOne({ _id: id, tenantId, workspaceId });
    if (!qt) return null;

    const uid = String(userId || '');
    const canReview =
      String(qt.reporterId) === uid ||
      role === 'super_admin' ||
      role === 'admin' ||
      role === 'manager' ||
      role === 'team_leader';

    if (!canReview) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    if (qt.status !== 'done') {
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

    qt.completionReview = {
      ...(qt.completionReview?.toObject?.() || qt.completionReview || {}),
      reviewStatus: action === 'approve' ? 'approved' : 'changes_requested',
      rating: action === 'approve' ? rating : null,
      reviewRemark: reviewRemark || '',
      reviewedAt: new Date(),
      reviewedBy: userId,
    };

    if (action === 'changes_requested') {
      qt.status = 'in_progress';
    }

    await qt.save();

    await ActivityLog.create({
      tenantId,
      workspaceId,
      userId,
      type: action === 'approve' ? 'quick_task_review_approved' : 'quick_task_review_changes_requested',
      description:
        action === 'approve'
          ? `Approved completed quick task "${qt.title}"`
          : `Requested changes for completed quick task "${qt.title}"`,
      entityType: 'quick_task',
      entityId: qt._id,
      metadata: {
        action,
        rating: action === 'approve' ? rating : null,
        reviewRemark: reviewRemark || '',
      },
    });

    const notifyUserIds = Array.from(
      new Set([
        ...((qt.assigneeIds || []).map((a) => String(a)) || []),
        String(qt.reporterId || ''),
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
          message:
            action === 'approve'
              ? `Review approved for "${qt.title}".`
              : `Changes were requested for "${qt.title}".`,
          isRead: false,
          relatedId: String(qt._id),
        }))
      );
    }

    return attachQuickTaskActivity({ companyId, workspaceId, tasks: [qt] }).then((items) => items[0] || mapQuickTaskWithActivity(qt, []));
  }

  export async function deleteQuickTask({ companyId, workspaceId, userId, id }) {
    const tenantId = companyId;
    const { QuickTask, ActivityLog } = await getTenantModels(companyId);
    const qt = await QuickTask.findOneAndDelete({ _id: id, tenantId, workspaceId });
    if (!qt) return null;

    await ActivityLog.create({
      tenantId,
      workspaceId,
      userId,
      type: 'quick_task_deleted',
      description: `Deleted quick task "${qt.title}"`,
      entityType: 'quick_task',
      entityId: qt._id,
      metadata: {},
    });

    return qt;
  }

  export async function addQuickTaskComment({ companyId, workspaceId, userId, role, taskId, content }) {
    const tenantId = companyId;
    const { QuickTask, Notification, ActivityLog } = await getTenantModels(companyId);

    const qt = await QuickTask.findOne({ _id: taskId, tenantId, workspaceId });
    if (!qt) return null;

    const uid = userId ? String(userId) : '';
    const reporterOk = String(qt.reporterId) === uid;
    const assigneeOk = (qt.assigneeIds || []).some((a) => String(a) === uid);
    const roleOk = role === 'super_admin' || role === 'admin' || role === 'manager' || role === 'team_leader';

    if (!roleOk && !reporterOk && !assigneeOk) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const comment = {
      content,
      authorId: userId,
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
      metadata: {
        content,
      },
    });

    // Notify other people involved (assignees + reporter) excluding the commenter.
    const notifyUserIds = Array.from(
      new Set([
        ...((updated?.assigneeIds || []).map((a) => String(a)) || []),
        String(updated?.reporterId || ''),
      ])
    ).filter((id) => id && id !== uid);

    if (notifyUserIds.length) {
      await Notification.insertMany(
        notifyUserIds.map((notifyUser) => ({
          tenantId,
          workspaceId,
          userId: notifyUser,
          type: 'comment_added',
          title: 'New comment on quick task',
          message: `New comment on "${updated?.title || 'quick task'}"`,
          isRead: false,
          relatedId: String(updated?._id),
        }))
      );
    }

    return attachQuickTaskActivity({ companyId, workspaceId, tasks: updated ? [updated] : [] }).then((items) => items[0] || null);
  }

  export async function addQuickTaskAttachments({ companyId, workspaceId, userId, role, taskId, files, requestBaseUrl }) {
    const tenantId = companyId;
    const { QuickTask, ActivityLog } = await getTenantModels(companyId);

    const qt = await QuickTask.findOne({ _id: taskId, tenantId, workspaceId });
    if (!qt) return null;

    const uid = userId ? String(userId) : '';
    const can =
      role === 'super_admin' ||
      role === 'admin' ||
      role === 'manager' ||
      role === 'team_leader' ||
      String(qt.reporterId) === uid ||
      (qt.assigneeIds || []).some((a) => String(a) === uid);

    if (!can) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const attachments = (files || []).map((f) => ({
      name: f.originalname,
      url: `${requestBaseUrl}/uploads/${f.filename}`,
      size: f.size,
      type: f.mimetype,
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

    return attachQuickTaskActivity({ companyId, workspaceId, tasks: updated ? [updated] : [] }).then((items) => items[0] || null);
  }

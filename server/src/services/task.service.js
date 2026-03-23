import mongoose from 'mongoose';
import { getTenantModels } from '../config/tenantDb.js';

function strId(x) {
  return x ? String(x) : '';
}

function isAdminRole(role) {
  return role === 'super_admin' || role === 'admin';
}

/** @returns {Promise<mongoose.Types.ObjectId[]|null>} null = all projects allowed */
export async function getAccessibleProjectIds({ tenantId, workspaceId, userId, role }) {
  const { Project, Team } = getTenantModels();
  if (isAdminRole(role)) return null;

  const uid = strId(userId);
  const projects = await Project.find({ tenantId, workspaceId }).lean();
  const allowed = [];

  for (const p of projects) {
    const pid = p._id;
    if (strId(p.ownerId) === uid || (p.members || []).some((m) => strId(m) === uid)) {
      allowed.push(pid);
      continue;
    }
    if (p.teamId) {
      const team = await Team.findOne({ _id: p.teamId, tenantId, workspaceId }).lean();
      if (team && (strId(team.leaderId) === uid || (team.members || []).some((m) => strId(m) === uid))) {
        allowed.push(pid);
      }
    }
  }
  return allowed;
}

function taskModifyRoles(role, task, userId) {
  if (isAdminRole(role)) return true;
  if (['manager', 'team_leader'].includes(role)) return true;
  const uid = strId(userId);
  if (strId(task.reporterId) === uid) return true;
  if ((task.assigneeIds || []).some((a) => strId(a) === uid)) return true;
  return false;
}

function mapIdList(values) {
  return Array.isArray(values) ? values.map((value) => strId(value)).filter(Boolean) : [];
}

function defaultCompletionReview() {
  return {
    completedAt: null,
    completedBy: null,
    completionRemark: '',
    reviewStatus: 'pending',
    reviewRemark: '',
    reviewedAt: null,
    reviewedBy: null,
  };
}

function buildCompletionState({ existingReview, existingStatus, nextStatus, updates, userId }) {
  const review = {
    ...defaultCompletionReview(),
    ...(existingReview || {}),
  };

  if (updates.completionRemark !== undefined) {
    review.completionRemark = updates.completionRemark || '';
  }

  const movedToDone = existingStatus !== 'done' && nextStatus === 'done';
  const movedAwayFromDone = existingStatus === 'done' && nextStatus !== 'done';

  if (movedToDone) {
    review.completedAt = new Date();
    review.completedBy = userId;
    review.reviewStatus = 'pending';
    review.reviewRemark = '';
    review.reviewedAt = null;
    review.reviewedBy = null;
  }

  if (movedAwayFromDone) {
    return defaultCompletionReview();
  }

  return review;
}

async function getTaskReviewUsers({ tenantId, workspaceId, projectId, task, fallbackReporterId }) {
  const { Project } = getTenantModels();
  const project = await Project.findOne({ _id: projectId, tenantId, workspaceId }).lean();
  return Array.from(
    new Set([
      strId(task?.reporterId || fallbackReporterId),
      ...(mapIdList(project?.reportingPersonIds)),
    ])
  ).filter(Boolean);
}

async function notifyUsers({ tenantId, workspaceId, userIds, type, title, message, relatedId }) {
  const { Notification } = getTenantModels();
  if (!userIds.length) return;
  await Notification.insertMany(
    userIds.map((userId) => ({
      tenantId,
      workspaceId,
      userId,
      type,
      title,
      message,
      isRead: false,
      relatedId: String(relatedId),
    }))
  );
}

function canReviewProjectTask({ role, userId, task, reviewerIds }) {
  if (isAdminRole(role) || ['manager', 'team_leader'].includes(role)) return true;
  const uid = strId(userId);
  if (strId(task.reporterId) === uid) return true;
  return reviewerIds.includes(uid);
}

export async function assertProjectAccess({ tenantId, workspaceId, userId, role, projectId }) {
  const allowed = await getAccessibleProjectIds({ tenantId, workspaceId, userId, role });
  if (allowed === null) return true;
  return allowed.some((id) => strId(id) === strId(projectId));
}

export async function listTasks({
  companyId,
  workspaceId,
  projectId,
  assigneeId,
  status,
  priority,
  page = 1,
  limit = 200,
  userId,
  role,
}) {
  const tenantId = companyId;
  const { Task } = getTenantModels();
  const filter = {
    tenantId,
    workspaceId,
    $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }],
  };

  const allowed = await getAccessibleProjectIds({ tenantId, workspaceId, userId, role });
  if (allowed !== null) {
    if (allowed.length === 0) {
      return { items: [], total: 0, page, limit };
    }
    if (projectId) {
      const ok = allowed.some((id) => strId(id) === strId(projectId));
      if (!ok) return { items: [], total: 0, page, limit };
      filter.projectId = projectId;
    } else {
      filter.projectId = { $in: allowed };
    }
  } else if (projectId) {
    filter.projectId = projectId;
  }

  if (assigneeId) filter.assigneeIds = assigneeId;
  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Task.find(filter).sort({ projectId: 1, status: 1, order: 1 }).skip(skip).limit(limit),
    Task.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function createTask({ companyId, workspaceId, userId, role, data }) {
  const tenantId = companyId;
  const ok = await assertProjectAccess({ tenantId, workspaceId, userId, role, projectId: data.projectId });
  if (!ok) {
    const err = new Error('Forbidden: no access to this project');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const { Task, Project, ActivityLog, Notification } = getTenantModels();
  const task = await Task.create({
    tenantId,
    workspaceId,
    projectId: data.projectId,
    title: data.title,
    description: data.description,
    status: data.status || 'todo',
    taskType: data.taskType || 'operational',
    priority: data.priority || 'medium',
    assigneeIds: data.assigneeIds || [],
    reporterId: userId,
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    estimatedHours: data.estimatedHours ?? null,
    order: data.order ?? 0,
    labels: data.labels || [],
    subtasks: Array.isArray(data.subtasks)
      ? data.subtasks.map((s, i) => ({
          title: s.title,
          isCompleted: Boolean(s.isCompleted),
          order: s.order ?? i,
        }))
      : [],
  });

  await Project.updateOne({ _id: task.projectId, tenantId, workspaceId }, { $inc: { tasksCount: 1 } });

  await ActivityLog.create({
    tenantId,
    workspaceId,
    userId,
    type: 'task_created',
    description: `Created task "${task.title}"`,
    entityType: 'task',
    entityId: task._id,
    metadata: { projectId: task.projectId },
  });

  if (task.assigneeIds?.length) {
    await Notification.insertMany(
      task.assigneeIds.map((assignee) => ({
        tenantId,
        workspaceId,
        userId: assignee,
        type: 'task_assigned',
        title: 'Task assigned to you',
        message: `You were assigned "${task.title}"`,
        isRead: false,
        relatedId: String(task._id),
      }))
    );
  }

  return task;
}

export async function getTaskById({ companyId, workspaceId, userId, role, taskId }) {
  const tenantId = companyId;
  const { Task } = getTenantModels();
  const task = await Task.findOne({
    _id: taskId,
    tenantId,
    workspaceId,
    $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }],
  });
  if (!task) return null;
  const ok = await assertProjectAccess({ tenantId, workspaceId, userId, role, projectId: task.projectId });
  if (!ok) return null;
  return task;
}

export async function updateTask({ companyId, workspaceId, userId, role, taskId, updates }) {
  const tenantId = companyId;
  const { Task, ActivityLog } = getTenantModels();
  const existing = await Task.findOne({
    _id: taskId,
    tenantId,
    workspaceId,
    $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }],
  });
  if (!existing) return null;
  if (!taskModifyRoles(role, existing, userId)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const { subtasks, dueDate, startDate, completionRemark, ...rest } = updates;
  const nextStatus = rest.status ?? existing.status;
  const $set = { ...rest };
  if (dueDate !== undefined) $set.dueDate = dueDate ? new Date(dueDate) : null;
  if (startDate !== undefined) $set.startDate = startDate ? new Date(startDate) : null;
  if (subtasks !== undefined) $set.subtasks = subtasks;
  if (completionRemark !== undefined || rest.status !== undefined) {
    $set.completionReview = buildCompletionState({
      existingReview: existing.completionReview,
      existingStatus: existing.status,
      nextStatus,
      updates: { completionRemark },
      userId,
    });
  }

  const task = await Task.findOneAndUpdate({ _id: taskId, tenantId, workspaceId }, { $set }, { new: true });
  if (!task) return null;

  await ActivityLog.create({
    tenantId,
    workspaceId,
    userId,
    type: 'task_updated',
    description: `Updated task "${task.title}"`,
    entityType: 'task',
    entityId: task._id,
    metadata: { projectId: task.projectId },
  });

  if (existing.status !== 'done' && task.status === 'done') {
    const reviewerIds = (await getTaskReviewUsers({
      tenantId,
      workspaceId,
      projectId: task.projectId,
      task,
      fallbackReporterId: existing.reporterId,
    })).filter((id) => id !== strId(userId));

    await notifyUsers({
      tenantId,
      workspaceId,
      userIds: reviewerIds,
      type: 'project_update',
      title: 'Task completed and awaiting review',
      message: `"${task.title}" was marked complete and needs review.`,
      relatedId: task._id,
    });
  }

  return task;
}

export async function moveTaskStatus({ companyId, workspaceId, userId, role, taskId, status }) {
  return updateTask({ companyId, workspaceId, userId, role, taskId, updates: { status } });
}

export async function reviewTaskCompletion({ companyId, workspaceId, userId, role, taskId, action, reviewRemark }) {
  const tenantId = companyId;
  const { Task, ActivityLog } = getTenantModels();
  const task = await Task.findOne({
    _id: taskId,
    tenantId,
    workspaceId,
    $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }],
  });
  if (!task) return null;

  const reviewerIds = await getTaskReviewUsers({
    tenantId,
    workspaceId,
    projectId: task.projectId,
    task,
    fallbackReporterId: task.reporterId,
  });

  if (!canReviewProjectTask({ role, userId, task, reviewerIds })) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (task.status !== 'done') {
    const err = new Error('Only completed tasks can be reviewed');
    err.statusCode = 400;
    err.code = 'INVALID_STATE';
    throw err;
  }

  const nextReviewStatus = action === 'approve' ? 'approved' : 'changes_requested';
  task.completionReview = {
    ...defaultCompletionReview(),
    ...(task.completionReview?.toObject?.() || task.completionReview || {}),
    reviewStatus: nextReviewStatus,
    reviewRemark: reviewRemark || '',
    reviewedAt: new Date(),
    reviewedBy: userId,
  };

  if (action === 'changes_requested') {
    task.status = 'in_review';
  }

  await task.save();

  await ActivityLog.create({
    tenantId,
    workspaceId,
    userId,
    type: action === 'approve' ? 'task_review_approved' : 'task_review_changes_requested',
    description:
      action === 'approve'
        ? `Approved completed task "${task.title}"`
        : `Requested changes for completed task "${task.title}"`,
    entityType: 'task',
    entityId: task._id,
    metadata: { projectId: task.projectId },
  });

  const notifyIds = Array.from(new Set([
    ...mapIdList(task.assigneeIds),
    strId(task.reporterId),
  ])).filter((id) => id && id !== strId(userId));

  await notifyUsers({
    tenantId,
    workspaceId,
    userIds: notifyIds,
    type: 'project_update',
    title: action === 'approve' ? 'Task review approved' : 'Task changes requested',
    message:
      action === 'approve'
        ? `Review approved for "${task.title}".`
        : `Changes were requested for "${task.title}".`,
    relatedId: task._id,
  });

  return task;
}

export async function deleteTask({ companyId, workspaceId, userId, role, taskId }) {
  const tenantId = companyId;
  const { Task, Project, ActivityLog } = getTenantModels();
  const existing = await Task.findOne({
    _id: taskId,
    tenantId,
    workspaceId,
    $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }],
  });
  if (!existing) return null;
  if (!['super_admin', 'admin', 'manager', 'team_leader'].includes(role)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const task = await Task.findOneAndDelete({ _id: taskId, tenantId, workspaceId });
  if (!task) return null;

  await Project.updateOne({ _id: task.projectId, tenantId, workspaceId }, { $inc: { tasksCount: -1 } });

  await ActivityLog.create({
    tenantId,
    workspaceId,
    userId,
    type: 'task_deleted',
    description: `Deleted task "${task.title}"`,
    entityType: 'task',
    entityId: task._id,
    metadata: { projectId: task.projectId },
  });

  return task;
}

export async function addSubtask({ companyId, workspaceId, userId, role, taskId, title }) {
  const tenantId = companyId;
  const { Task } = getTenantModels();
  const task = await Task.findOne({
    _id: taskId,
    tenantId,
    workspaceId,
    $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }],
  });
  if (!task) return null;
  if (!taskModifyRoles(role, task, userId)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const order = (task.subtasks?.length || 0) + 1;
  task.subtasks.push({ title, isCompleted: false, order });
  await task.save();
  return task;
}

export async function updateSubtask({ companyId, workspaceId, userId, role, taskId, subtaskId, updates }) {
  const tenantId = companyId;
  const { Task } = getTenantModels();
  const task = await Task.findOne({
    _id: taskId,
    tenantId,
    workspaceId,
    $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }],
  });
  if (!task) return null;
  if (!taskModifyRoles(role, task, userId)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const sub = task.subtasks.id(subtaskId);
  if (!sub) return null;
  if (updates.title !== undefined) sub.title = updates.title;
  if (updates.isCompleted !== undefined) sub.isCompleted = Boolean(updates.isCompleted);
  if (updates.order !== undefined) sub.order = updates.order;
  await task.save();
  return task;
}

export async function removeSubtask({ companyId, workspaceId, userId, role, taskId, subtaskId }) {
  const tenantId = companyId;
  const { Task } = getTenantModels();
  const task = await Task.findOne({
    _id: taskId,
    tenantId,
    workspaceId,
    $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }],
  });
  if (!task) return null;
  if (!taskModifyRoles(role, task, userId)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const sub = task.subtasks.id(subtaskId);
  if (!sub) return null;
  sub.deleteOne();
  await task.save();
  return task;
}

export async function addTaskAttachments({ companyId, workspaceId, userId, role, taskId, files, requestBaseUrl }) {
  const tenantId = companyId;
  const { Task } = getTenantModels();

  const task = await Task.findOne({
    _id: taskId,
    tenantId,
    workspaceId,
  });
  if (!task) return null;

  if (!taskModifyRoles(role, task, userId)) {
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

  if (!attachments.length) return task;

  await Task.updateOne({ _id: taskId, tenantId, workspaceId }, { $push: { attachments } });
  return Task.findOne({ _id: taskId, tenantId, workspaceId });
}

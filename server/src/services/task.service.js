import mongoose from 'mongoose';
import { getTenantModels } from '../config/tenantDb.js';
import { sendTemplatedEmailSafe } from './mail.service.js';
import { syncProjectStats } from './project.service.js';
import { hasWorkspacePermission } from './permission.service.js';
import { assertAllowedTaskTitle, normalizeTaskTitle } from '../utils/taskTitleValidation.js';
import { getTaskActivityModel } from '../models/TaskActivity.js';
import { uploadIncomingFiles } from './storage.service.js';
import { isTaskOverdue, getOverdueQueryFilter } from '../utils/task.utils.js';

function strId(x) {
  if (!x) return '';
  if (typeof x === 'object') {
    return String(x._id || x.id || x);
  }
  return String(x);
}

async function logTaskActivity({ tenantId, taskId, userId, action, oldValue, newValue, message }) {
  try {
    const TaskActivity = await getTaskActivityModel(tenantId);
    await TaskActivity.create({
      tenantId,
      taskId,
      userId,
      action,
      oldValue: oldValue ? String(oldValue) : null,
      newValue: newValue ? String(newValue) : null,
      message,
    });
  } catch (err) {
    console.error('[logTaskActivity] Error:', err);
  }
}

async function updateTaskStatusHistory({ tenantId, taskId, userId, fromStatus, toStatus, type = 'project' }) {
  try {
    const { Task, QuickTask } = await getTenantModels(tenantId);
    const Model = type === 'quick' ? QuickTask : Task;
    const task = await Model.findById(taskId);
    if (!task) return;

    const now = new Date();
    const history = task.statusHistory || [];

    // Close previous status if exists
    if (history.length > 0) {
      const lastEntry = history[history.length - 1];
      if (!lastEntry.endTime) {
        lastEntry.endTime = now;
        lastEntry.duration = Math.max(0, Math.floor((now.getTime() - new Date(lastEntry.startTime).getTime()) / 1000));
      }
    }

    // Add new status entry
    history.push({
      status: toStatus,
      startTime: now,
      endTime: null
    });

    task.statusHistory = history;
    await task.save();

    // 2. Implement Step 2: timeLogs
    const timeLogs = task.timeLogs || [];
    // Case 2: Exiting previous status - close open logs
    for (const log of timeLogs) {
      if (!log.endTime) {
        log.endTime = now;
        log.duration = Math.max(0, Math.floor((now.getTime() - new Date(log.startTime).getTime()) / 1000));
      }
    }

    // Case 1: Entering a status (unless already completed)
    if (toStatus !== 'done') {
      timeLogs.push({
        status: toStatus,
        startTime: now,
        endTime: null,
        duration: 0,
        userId: userId
      });
    }

    task.timeLogs = timeLogs;

    // 3. Step 5: Calculation Logic
    let total = 0;
    let inProgress = 0;
    for (const log of timeLogs) {
      const start = new Date(log.startTime).getTime();
      const end = log.endTime ? new Date(log.endTime).getTime() : now.getTime();
      const dur = Math.max(0, Math.floor((end - start) / 1000));

      total += dur;
      if (log.status?.toLowerCase() === 'in_progress') {
        inProgress += dur;
      }
    }

    task.timeAnalytics = {
      totalTimeSpent: total,
      inProgressTime: inProgress
    };

    await task.save();

    // Also log to TaskActivity
    await logTaskActivity({
      tenantId,
      taskId,
      userId,
      action: 'STATUS_CHANGED',
      oldValue: fromStatus,
      newValue: toStatus,
      message: `Changed status from ${fromStatus} to ${toStatus}`
    });
  } catch (err) {
    console.error('[updateTaskStatusHistory] Error:', err);
  }
}

export function calculateTimeSpent(statusHistory) {
  if (!Array.isArray(statusHistory)) return { totalTimeSpent: 0, timeSpentByStatus: {}, statusHistory: [] };

  const timeSpentByStatus = {};
  let totalTimeSpent = 0;
  const now = new Date();

  const historyPoints = statusHistory.map(entry => {
    const start = new Date(entry.startTime);
    const end = entry.endTime ? new Date(entry.endTime) : now;
    const duration = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));

    timeSpentByStatus[entry.status] = (timeSpentByStatus[entry.status] || 0) + duration;
    totalTimeSpent += duration;

    return {
      status: entry.status,
      changedAt: entry.startTime,
      duration
    };
  });

  return {
    totalTimeSpent,
    timeSpentByStatus,
    statusHistory: historyPoints
  };
}

export async function listTaskActivities({ tenantId, taskId }) {
  const TaskActivity = await getTaskActivityModel(tenantId);
  return TaskActivity.find({ tenantId, taskId }).sort({ createdAt: -1 }).limit(100);
}

export async function getTaskTimeTracking({ tenantId, taskId, type }) {
  let task;
  const { QuickTask, Task } = await getTenantModels(tenantId);
  if (type === 'quick') {
    task = await QuickTask.findById(taskId);
  } else {
    task = await Task.findById(taskId);
  }

  if (!task) return null;
  return calculateTimeSpent(task.statusHistory);
}

function isAdminRole(role) {
  return role === 'super_admin' || role === 'admin';
}

function hasFullProjectAccess(role) {
  return isAdminRole(role);
}

function canApproveTaskRequest({ role, userId, project }) {
  if (isAdminRole(role) || role === 'manager' || role === 'team_leader') return true;
  const uid = strId(userId);
  return (project?.reportingPersonIds || []).some((memberId) => strId(memberId) === uid);
}

/** @returns {Promise<mongoose.Types.ObjectId[]|null>} null = all projects allowed */
export async function getAccessibleProjectIds({ tenantId, workspaceId, userId, role }) {
  const { Project, Team } = await getTenantModels(tenantId);
  const canSeeOthers = await hasWorkspacePermission({
    companyId: tenantId,
    workspaceId,
    role,
    permissionKey: 'seeOtherProjects',
  });
  const canEditOthers = await hasWorkspacePermission({
    companyId: tenantId,
    workspaceId,
    role,
    permissionKey: 'editOtherProjects',
  });
  if (hasFullProjectAccess(role) || canSeeOthers || canEditOthers) return null;

  const uid = strId(userId);
  const projects = await Project.find({ tenantId, workspaceId }).lean();
  const allowed = [];

  for (const p of projects) {
    const pid = p._id;
    if (
      strId(p.ownerId) === uid ||
      (p.members || []).some((m) => strId(m) === uid) ||
      (p.reportingPersonIds || []).some((m) => strId(m) === uid)
    ) {
      allowed.push(pid);
      continue;
    }
    if (p.teamId) {
      const team = await Team.findOne({ _id: p.teamId, tenantId, workspaceId }).lean();
      if (
        team && (
          strId(team.leaderId) === uid ||
          (team.leaderIds || []).some((leaderId) => strId(leaderId) === uid) ||
          (team.members || []).some((m) => strId(m) === uid)
        )
      ) {
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

function buildDirectTaskAccessFilter(userId) {
  return {
    $or: [
      { assigneeIds: userId },
      { reporterId: userId },
    ],
  };
}

function sameIdList(left, right) {
  const normalizedLeft = Array.from(new Set((left || []).map((value) => strId(value)).filter(Boolean))).sort();
  const normalizedRight = Array.from(new Set((right || []).map((value) => strId(value)).filter(Boolean))).sort();
  if (normalizedLeft.length !== normalizedRight.length) return false;
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function sameDateValue(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return new Date(left).getTime() === new Date(right).getTime();
}

function canViewQuickTask({ role, userId, task }) {
  const uid = strId(userId);
  const isOwner = (
    strId(task.reporterId) === uid ||
    strId(task.createdBy) === uid ||
    (task.assigneeIds || []).some((assigneeId) => strId(assigneeId) === uid)
  );

  if (task.isPrivate) {
    return isAdminRole(role) || isOwner;
  }

  if (isAdminRole(role) || ['manager', 'team_leader'].includes(role)) return true;
  return isOwner;
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
    rating: null,
    reviewRemark: '',
    reviewedAt: null,
    reviewedBy: null,
  };
}

async function createSubtaskNotification({ tenantId, workspaceId, assigneeId, taskTitle, subtaskTitle, taskId }) {
  if (!assigneeId) return;
  const { Notification } = await getTenantModels(tenantId);
  await Notification.create({
    tenantId,
    workspaceId,
    userId: assigneeId,
    type: 'task_assigned',
    title: 'You were assigned a subtask',
    message: `${subtaskTitle} · ${taskTitle}`,
    relatedId: String(taskId),
    audienceType: 'user',
    audienceLabel: 'Direct',
  });
}

function buildCompletionState({ existingReview, existingStatus, nextStatus, updates, userId }) {
  const review = {
    ...defaultCompletionReview(),
    ...(existingReview || {}),
  };

  if (updates.completionRemark !== undefined) {
    review.completionRemark = updates.completionRemark || '';
  }

  if (updates.reviewRemark !== undefined) {
    review.reviewRemark = updates.reviewRemark || '';
  }

  if (updates.rating !== undefined) {
    review.rating = updates.rating || null;
  }

  const movedToDone = existingStatus !== 'done' && nextStatus === 'done';
  const movedAwayFromDone = existingStatus === 'done' && nextStatus !== 'done';

  if (movedToDone) {
    review.completedAt = new Date();
    review.completedBy = userId;
    review.reviewStatus = 'pending';
    review.rating = null;
    review.reviewRemark = '';
    review.reviewedAt = null;
    review.reviewedBy = null;
  }

  // If moving to in_review specifically with a remark
  if (nextStatus === 'in_review') {
    review.reviewStatus = 'pending';
    if (!review.completedAt) {
      review.completedAt = new Date();
      review.completedBy = userId;
    }
  }

  if (movedAwayFromDone) {
    return defaultCompletionReview();
  }

  return review;
}

async function getTaskReviewUsers({ tenantId, workspaceId, projectId, task, fallbackReporterId }) {
  const { Project } = await getTenantModels(tenantId);
  const project = await Project.findOne({ _id: projectId, tenantId, workspaceId }).lean();
  return Array.from(
    new Set([
      strId(task?.reporterId || fallbackReporterId),
      ...(mapIdList(project?.reportingPersonIds)),
    ])
  ).filter(Boolean);
}

async function notifyUsers({ tenantId, workspaceId, userIds, type, title, message, relatedId }) {
  const { Notification } = await getTenantModels(tenantId);
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

function addDaysUtc(date, days) {
  const base = date instanceof Date ? date : new Date(date);
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days));
}

function resolveTaskSchedule(data) {
  const requestedStartDate = data.startDate ? new Date(data.startDate) : new Date();
  const startDate = Number.isNaN(requestedStartDate.getTime()) ? new Date() : requestedStartDate;
  const requestedDueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (requestedDueDate && !Number.isNaN(requestedDueDate.getTime())) {
    const diffMs = requestedDueDate.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return {
      startDate,
      dueDate: requestedDueDate,
      durationDays: Math.max(1, diffDays),
    };
  }

  const rawDurationDays = Number(data.durationDays);
  if (!Number.isFinite(rawDurationDays) || rawDurationDays < 1) {
    const err = new Error('Task duration is required.');
    err.statusCode = 400;
    err.code = 'TASK_DURATION_REQUIRED';
    throw err;
  }

  const durationDays = Math.max(1, Math.round(rawDurationDays));
  return {
    startDate,
    dueDate: addDaysUtc(startDate, durationDays - 1),
    durationDays,
  };
}

function mapRequestWithActivity(request) {
  return typeof request?.toJSON === 'function' ? request.toJSON() : request;
}

async function sendTaskAssignmentEmails({ tenantId, assigneeIds, actorId, task, projectName }) {
  const uniqueAssigneeIds = Array.from(new Set(mapIdList(assigneeIds))).filter(Boolean);
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
          templateKey: 'taskAssigned',
          variables: {
            userName: user.name || 'User',
            taskTitle: task.title,
            projectName: projectName || 'Workspace task',
            priority: task.priority || 'medium',
            dueDate: formatMailDate(task.dueDate),
            assignedBy: actor?.name || 'Administrator',
            taskUrl: `/tasks/${task._id}`,
          },
        })
      )
  );
}

function canReviewProjectTask({ role, userId, task, reviewerIds }) {
  const uid = strId(userId);
  if (isAdminRole(role) || ['manager', 'team_leader'].includes(role)) return true;
  if ((task.assigneeIds || []).some((assigneeId) => strId(assigneeId) === uid)) return false;
  return reviewerIds.includes(uid);
}

function mapTaskWithActivity(task, activityHistory) {
  const json = typeof task?.toJSON === 'function' ? task.toJSON() : typeof task === 'object' ? task : {};

  let totalTime = 0;
  const timeByUserMap = new Map();
  const timeByStageMap = new Map();

  const timeLogs = Array.isArray(json.timeLogs) ? json.timeLogs : [];
  const statusHistory = Array.isArray(json.statusHistory) ? json.statusHistory : [];

  // fallback if timeLogs are missing
  if (timeLogs.length === 0 && statusHistory.length > 0) {
    const now = new Date().getTime();
    statusHistory.forEach((entry) => {
      const start = new Date(entry.startTime).getTime();
      const end = entry.endTime ? new Date(entry.endTime).getTime() : now;
      const duration = Math.max(0, Math.floor((end - start) / 1000));
      totalTime += duration;
      timeByStageMap.set(entry.status, (timeByStageMap.get(entry.status) || 0) + duration);
    });
  } else {
    const now = new Date().getTime();
    timeLogs.forEach((log) => {
      const start = new Date(log.startTime).getTime();
      const end = log.endTime ? new Date(log.endTime).getTime() : now;
      const duration = Math.max(0, Math.floor((end - start) / 1000));
      totalTime += duration;

      if (log.status) {
        timeByStageMap.set(log.status, (timeByStageMap.get(log.status) || 0) + duration);
      }

      if (log.userId) {
        const uId = strId(log.userId);
        timeByUserMap.set(uId, (timeByUserMap.get(uId) || 0) + duration);
      }
    });
  }

  const timeByUser = Array.from(timeByUserMap.entries()).map(([userId, time]) => ({ userId, time }));
  const timeByStage = Array.from(timeByStageMap.entries()).map(([stage, time]) => ({ stage, time }));

  return {
    ...json,
    activityHistory: Array.isArray(activityHistory) ? activityHistory : [],
    totalTime,
    timeByUser,
    timeByStage
  };
}

async function attachTaskActivity({ companyId, workspaceId, tasks }) {
  const { ActivityLog } = await getTenantModels(companyId);
  const taskList = Array.isArray(tasks) ? tasks : [];
  if (!taskList.length) return [];

  const logs = await ActivityLog.find({
    tenantId: companyId,
    workspaceId,
    entityType: 'task',
    entityId: { $in: taskList.map((task) => task?._id).filter(Boolean) },
  }).sort({ createdAt: -1 });

  const logsByTaskId = new Map();
  for (const log of logs) {
    const key = String(log.entityId);
    const items = logsByTaskId.get(key) || [];
    items.push(log.toJSON());
    logsByTaskId.set(key, items);
  }

  return taskList.map((task) => mapTaskWithActivity(task, logsByTaskId.get(String(task._id)) || []));
}

export async function assertProjectAccess({ tenantId, workspaceId, userId, role, projectId }) {
  if (!projectId) return true; // Allow access to workspace-level tasks that don't belong to a project

  const { Project } = await getTenantModels(tenantId);
  const project = await Project.findOne({ _id: projectId, tenantId, workspaceId }).select('_id').lean();
  if (!project) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    err.code = 'PROJECT_NOT_FOUND';
    throw err;
  }

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
  labels,
  tags,
  reviewStatus,
}) {
  const tenantId = companyId;
  const { Task } = await getTenantModels(companyId);
  const filter = await buildTaskVisibilityFilter({
    tenantId,
    workspaceId,
    projectId,
    userId,
    role,
    labels,
    tags,
    assigneeId,
    status,
    priority,
    reviewStatus,
  });

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Task.find(filter)
      .sort({ updatedAt: -1, projectId: 1, status: 1, order: 1 })
      .populate('labels')
      .populate('assigneeIds', 'name avatar color')
      .skip(skip)
      .limit(limit),
    Task.countDocuments(filter),
  ]);
  return { items: await attachTaskActivity({ companyId, workspaceId, tasks: items }), total, page, limit };
}

export async function buildTaskVisibilityFilter({
  tenantId,
  workspaceId,
  projectId,
  userId,
  role,
  labels,
  tags,
  assigneeId,
  status,
  priority,
  reviewStatus,
}) {
  const base = {
    tenantId,
  };

  if (workspaceId && (projectId || !isAdminRole(role))) {
    base.workspaceId = workspaceId;
  }

  Object.assign(base, {
    $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }],
  });

  if (labels && Array.isArray(labels)) {
    const validLabels = labels.filter((l) => l && typeof l === 'string' && l.trim().length > 0);
    if (validLabels.length > 0) base.labels = { $in: validLabels };
  }
  if (tags && Array.isArray(tags)) {
    const validTags = tags.filter((t) => t && typeof t === 'string' && t.trim().length > 0);
    if (validTags.length > 0) base.tags = { $in: validTags };
  }

  const allowed = await getAccessibleProjectIds({ tenantId, workspaceId, userId, role });
  if (allowed !== null) {
    if (projectId) {
      base.projectId = projectId;
      if (!allowed.some((id) => strId(id) === strId(projectId))) {
        Object.assign(base, buildDirectTaskAccessFilter(userId));
      }
    } else {
      base.$and = [
        { $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }] },
        {
          $or: [
            ...(allowed.length ? [{ projectId: { $in: allowed } }] : []),
            buildDirectTaskAccessFilter(userId),
          ],
        },
      ];
      delete base.$or;
    }
  } else if (projectId) {
    base.projectId = projectId;
  }

  if (assigneeId) base.assigneeIds = assigneeId;
  if (status) {
    if (status === 'overdue') {
      const { dueDate, status: filteredStatus } = getOverdueQueryFilter(new Date());
      base.dueDate = dueDate;
      base.status = filteredStatus;
    } else if (typeof status === 'string' && status.includes(',')) {
      base.status = { $in: status.split(',').filter(Boolean) };
    } else {
      base.status = status;
    }
  }
  if (priority) base.priority = priority;

  if (reviewStatus) {
    base['completionReview.reviewStatus'] = reviewStatus;
  }

  // GLOBAL ARCHIVE FILTER: Exclude tasks from archived projects unless a specific projectId is requested
  if (!projectId) {
    const { Project } = await getTenantModels(tenantId);
    const archivedProjects = await Project.find({ tenantId, workspaceId, status: 'archived' }).select('_id').lean();
    if (archivedProjects.length > 0) {
      const archivedIds = archivedProjects.map(p => p._id);
      if (base.$and) {
        base.$and.push({ projectId: { $nin: archivedIds } });
      } else {
        base.projectId = { $nin: archivedIds };
      }
    }
  }

  return base;
}

export async function createTask({ companyId, workspaceId, userId, role, data }) {
  const tenantId = companyId;
  const { Task, Project, ActivityLog, Notification } = await getTenantModels(companyId);

  // Validate project existence early
  const project = await Project.findOne({ _id: data.projectId, tenantId, workspaceId }).select('name').lean();
  if (!project) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    err.code = 'PROJECT_NOT_FOUND';
    throw err;
  }

  const ok = await assertProjectAccess({ tenantId, workspaceId, userId, role, projectId: data.projectId });
  if (!ok) {
    const err = new Error('Forbidden: no access to this project');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const normalizedTitle = normalizeTaskTitle(data.title);
  assertAllowedTaskTitle(normalizedTitle);
  const { startDate, dueDate, durationDays } = resolveTaskSchedule(data);
  const normalizedAssigneeIds = Array.isArray(data.assigneeIds) ? data.assigneeIds : [];

  // Enforce: at least one assignee required
  if (normalizedAssigneeIds.length === 0) {
    const err = new Error('At least one assignee is required to create a task.');
    err.statusCode = 400;
    err.code = 'ASSIGNEE_REQUIRED';
    throw err;
  }

  const recentMatchingTasks = await Task.find({
    tenantId,
    workspaceId,
    projectId: data.projectId,
    reporterId: userId,
    title: normalizedTitle,
    createdAt: { $gte: new Date(Date.now() - 15000) },
  })
    .sort({ createdAt: -1 })
    .limit(5);

  const duplicateTask = recentMatchingTasks.find((item) =>
    String(item.description || '') === String(data.description || '') &&
    String(item.status || 'todo') === String(data.status || 'todo') &&
    String(item.taskType || 'operational') === String(data.taskType || 'operational') &&
    String(item.priority || 'medium') === String(data.priority || 'medium') &&
    sameIdList(item.assigneeIds, normalizedAssigneeIds) &&
    sameDateValue(item.startDate, startDate) &&
    sameDateValue(item.dueDate, dueDate) &&
    String(item.phaseId || '') === String(data.phaseId || '') &&
    String(item.subcategoryId || '') === String(data.subcategoryId || '')
  );

  if (duplicateTask) {
    return (await attachTaskActivity({ companyId, workspaceId, tasks: [duplicateTask] }))[0];
  }

  const task = await Task.create({
    tenantId,
    workspaceId,
    projectId: data.projectId,
    title: normalizedTitle,
    description: data.description,
    status: data.status || 'todo',
    taskType: data.taskType || 'operational',
    priority: data.priority || 'medium',
    assigneeIds: normalizedAssigneeIds,
    reporterId: userId,
    startDate,
    dueDate,
    duration: durationDays * 24 * 60,
    phaseId: data.phaseId || null,
    subcategoryId: data.subcategoryId || null,
    dependencies: Array.isArray(data.dependencies) ? data.dependencies : [],
    timelineType: data.type || 'task',
    estimatedHours: data.estimatedHours ?? null,
    order: data.order ?? 0,
    tags: Array.isArray(data.tags) ? data.tags : [],
    labels: Array.isArray(data.labels) ? data.labels : [],
    repeatSchedule: data.repeatSchedule || "Don't Repeat",
    isRecurring: data.repeatSchedule && data.repeatSchedule !== "Don't Repeat",
    recurrenceRule: data.repeatSchedule === "Every Day" ? { frequency: 'daily', interval: 1 } :
                    data.repeatSchedule === "Every Week" ? { frequency: 'weekly', interval: 1 } :
                    data.repeatSchedule === "Every Month" ? { frequency: 'monthly', interval: 1 } : null,
    subtasks: Array.isArray(data.subtasks)
      ? data.subtasks.map((s, i) => ({
        title: s.title,
        isCompleted: Boolean(s.isCompleted),
        order: s.order ?? i,
      }))
      : [],
  });


  await ActivityLog.create({
    tenantId,
    workspaceId,
    userId,
    type: 'task_created',
    description: `Created task "${task.title}"`,
    entityType: 'TASK',
    entityId: task._id,
    metadata: { projectId: task.projectId },
  });

  // Log initial status
  await updateTaskStatusHistory({
    tenantId,
    taskId: task._id,
    userId,
    fromStatus: null,
    toStatus: task.status,
    type: 'project'
  });
  await logTaskActivity({
    tenantId,
    taskId: task._id,
    userId,
    action: 'CREATED',
    message: `Created task "${task.title}" with status "${task.status}"`
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
    await sendTaskAssignmentEmails({
      tenantId,
      assigneeIds: task.assigneeIds,
      actorId: userId,
      task,
      projectName: project?.name || 'Untitled Project',
    });
  }

  await syncProjectStats(companyId, workspaceId, task.projectId);

  return (await attachTaskActivity({ companyId, workspaceId, tasks: [task] }))[0];
}

export async function listTaskCreationRequests({ companyId, workspaceId, userId, role, projectId, requestStatus }) {
  const tenantId = companyId;
  const { TaskCreationRequest, Project } = await getTenantModels(companyId);
  const filter = { tenantId, workspaceId };
  if (projectId) {
    const ok = await assertProjectAccess({ tenantId, workspaceId, userId, role, projectId });
    if (!ok) {
      const err = new Error('Forbidden: no access to this project');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const project = await Project.findOne({ _id: projectId, tenantId, workspaceId }).lean();
    if (!project) return [];

    filter.projectId = projectId;
    if (!canApproveTaskRequest({ role, userId, project })) {
      filter.requestedBy = userId;
    }
  } else if (!isAdminRole(role) && role !== 'manager' && role !== 'team_leader') {
    filter.$or = [
      { requestedBy: userId },
      { requestedToIds: userId },
    ];
  }
  if (requestStatus) filter.requestStatus = requestStatus;

  const requests = await TaskCreationRequest.find(filter).sort({ createdAt: -1 });
  return requests.map(mapRequestWithActivity);
}

export async function createTaskCreationRequest({ companyId, workspaceId, userId, role, data }) {
  const tenantId = companyId;
  const ok = await assertProjectAccess({ tenantId, workspaceId, userId, role, projectId: data.projectId });
  if (!ok) {
    const err = new Error('Forbidden: no access to this project');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const { TaskCreationRequest, Project, ActivityLog } = await getTenantModels(companyId);
  const project = await Project.findOne({ _id: data.projectId, tenantId, workspaceId }).lean();
  if (!project) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    err.code = 'PROJECT_NOT_FOUND';
    throw err;
  }

  const reviewerIds = mapIdList(project.reportingPersonIds);
  if (!reviewerIds.length) {
    const err = new Error('This project has no reporting person configured for task requests');
    err.statusCode = 400;
    err.code = 'REPORTING_PERSON_REQUIRED';
    throw err;
  }

  const { startDate, dueDate, durationDays } = resolveTaskSchedule(data);

  const request = await TaskCreationRequest.create({
    tenantId,
    workspaceId,
    projectId: data.projectId,
    title: data.title,
    description: data.description,
    priority: data.priority || 'medium',
    status: data.status || 'todo',
    assigneeIds: Array.isArray(data.assigneeIds) ? data.assigneeIds : [],
    requestedBy: userId,
    requestedToIds: reviewerIds,
    startDate,
    dueDate,
    durationDays,
    phaseId: data.phaseId || null,
    subcategoryId: data.subcategoryId || null,
    estimatedHours: data.estimatedHours ?? null,
    order: data.order ?? 0,
    labels: data.labels || [],
    repeatSchedule: data.repeatSchedule || "Don't Repeat",
    isRecurring: data.repeatSchedule && data.repeatSchedule !== "Don't Repeat",
    recurrenceRule: data.repeatSchedule === "Every Day" ? { frequency: 'daily', interval: 1 } :
                    data.repeatSchedule === "Every Week" ? { frequency: 'weekly', interval: 1 } :
                    data.repeatSchedule === "Every Month" ? { frequency: 'monthly', interval: 1 } : null,
    subtasks: Array.isArray(data.subtasks)
      ? data.subtasks.map((subtask, index) => ({
        title: subtask.title,
        isCompleted: Boolean(subtask.isCompleted),
        order: subtask.order ?? index,
      }))
      : [],
  });

  await ActivityLog.create({
    tenantId,
    workspaceId,
    userId,
    type: 'task_creation_requested',
    description: `Requested task "${request.title}" in project "${project.name}"`,
    entityType: 'task_request',
    entityId: request._id,
    metadata: { projectId: project._id },
  });

  await notifyUsers({
    tenantId,
    workspaceId,
    userIds: reviewerIds,
    type: 'task_creation_request',
    title: 'New task creation request',
    message: `${request.title} is awaiting your approval.`,
    relatedId: request._id,
  });

  return mapRequestWithActivity(request);
}

export async function reviewTaskCreationRequest({
  companyId,
  workspaceId,
  userId,
  role,
  requestId,
  action,
  reviewNote,
}) {
  const tenantId = companyId;
  const { TaskCreationRequest, Project, ActivityLog } = await getTenantModels(companyId);
  const request = await TaskCreationRequest.findOne({ _id: requestId, tenantId, workspaceId });
  if (!request) return null;

  const project = await Project.findOne({ _id: request.projectId, tenantId, workspaceId }).lean();
  if (!project) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    err.code = 'PROJECT_NOT_FOUND';
    throw err;
  }

  if (!canApproveTaskRequest({ role, userId, project })) {
    const err = new Error('Only the reporting person or management can review this request');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (request.requestStatus !== 'pending') {
    const err = new Error('This request has already been reviewed');
    err.statusCode = 400;
    err.code = 'TASK_REQUEST_ALREADY_REVIEWED';
    throw err;
  }

  request.requestStatus = action === 'approve' ? 'approved' : 'rejected';
  request.reviewNote = reviewNote || '';
  request.reviewedAt = new Date();
  request.reviewedBy = userId;

  let createdTask = null;
  if (action === 'approve') {
    createdTask = await createTask({
      companyId,
      workspaceId,
      userId: request.requestedBy,
      role: 'team_member',
      data: {
        projectId: String(request.projectId),
        title: request.title,
        description: request.description,
        status: request.status,
        priority: request.priority,
        assigneeIds: mapIdList(request.assigneeIds),
        startDate: request.startDate ? new Date(request.startDate).toISOString().split('T')[0] : undefined,
        dueDate: request.dueDate ? new Date(request.dueDate).toISOString().split('T')[0] : undefined,
        durationDays: request.durationDays,
        phaseId: request.phaseId ? String(request.phaseId) : undefined,
        subcategoryId: request.subcategoryId || undefined,
        estimatedHours: request.estimatedHours,
        order: request.order,
        tags: request.tags || [],
        labels: request.labels || [],
        repeatSchedule: request.repeatSchedule,
        subtasks: Array.isArray(request.subtasks)
          ? request.subtasks.map((subtask) => ({
            title: subtask.title,
            isCompleted: Boolean(subtask.isCompleted),
            order: subtask.order ?? 0,
          }))
          : [],
      },
    });
    request.createdTaskId = createdTask.id;
  }

  await request.save();

  await ActivityLog.create({
    tenantId,
    workspaceId,
    userId,
    type: action === 'approve' ? 'task_creation_request_approved' : 'task_creation_request_rejected',
    description: `${action === 'approve' ? 'Approved' : 'Rejected'} task request "${request.title}"`,
    entityType: 'task_request',
    entityId: request._id,
    metadata: {
      projectId: request.projectId,
      createdTaskId: request.createdTaskId || undefined,
    },
  });

  await notifyUsers({
    tenantId,
    workspaceId,
    userIds: [strId(request.requestedBy)].filter(Boolean),
    type: action === 'approve' ? 'task_request_approved' : 'task_request_rejected',
    title: action === 'approve' ? 'Task request approved' : 'Task request rejected',
    message: action === 'approve'
      ? `${request.title} has been approved and created as a project task.`
      : `${request.title} has been rejected.`,
    relatedId: request._id,
  });

  return {
    request: mapRequestWithActivity(request),
    createdTask,
  };
}

export async function getTaskById({ companyId, workspaceId, userId, role, taskId }) {
  const tenantId = companyId;
  const { Task } = await getTenantModels(companyId);

  // Search by ID and tenantId only to allow finding tasks across workspaces in unified views.
  // Security is maintained via assertProjectAccess and taskModifyRoles checks below.
  let task = await Task.findOne({ _id: taskId, tenantId })
    .populate('assigneeIds', 'name avatar color fontColor')
    .populate('reporterId', 'name avatar color fontColor')
    .populate('projectId', 'name')
    .populate('labels')
    .populate('subtasks.assigneeId', 'name avatar color fontColor');

  if (!task) return null;

  // Use the task's actual workspaceId for project access check
  const ok = await assertProjectAccess({ tenantId, workspaceId: task.workspaceId, userId, role, projectId: task.projectId });
  if (!ok && !taskModifyRoles(role, task, userId)) return null;
  return (await attachTaskActivity({ companyId, workspaceId: task.workspaceId, tasks: [task] }))[0];
}

export async function getAnyTaskById({ companyId, workspaceId, userId, role, taskId }) {
  if (!mongoose.Types.ObjectId.isValid(taskId)) return null;
  const uid = new mongoose.Types.ObjectId(userId);

  // 1. Try project task
  const projectTask = await getTaskById({ companyId, workspaceId, userId, role, taskId });
  if (projectTask) {
    const t = typeof projectTask.toJSON === 'function' ? projectTask.toJSON() : projectTask;
    const reporterObj = projectTask?.reporterId;

    // If it's an object (populated), extract ID and Name
    const reporterId = typeof reporterObj === 'object' ? (reporterObj?._id || reporterObj?.id) : reporterObj;
    t.reporterId = reporterId ? String(reporterId) : (t.reporterId || '');
    t.reporterName = (typeof reporterObj === 'object' ? reporterObj?.name : null) || t.reporterName || 'System';
    t.reporterAvatar = (typeof reporterObj === 'object' ? reporterObj?.avatar : null) || t.reporterAvatar;

    // Handle assigneeIds mapping
    if (Array.isArray(t.assigneeIds)) {
      t.assigneeIds = t.assigneeIds.map(a => {
        if (typeof a === 'object') return String(a._id || a.id || a);
        return String(a);
      }).filter(Boolean);
    } else {
      t.assigneeIds = [];
    }

    t.type = 'project';
    return t;
  }

  // 2. Try quick task
  const { QuickTask, PersonalTask } = await getTenantModels(companyId);
  const quickTask = await QuickTask.findOne({ _id: taskId, tenantId: companyId })
    .populate('assigneeIds', 'name avatar color fontColor')
    .populate('reporterId', 'name avatar color fontColor');

  if (quickTask) {
    if (!canViewQuickTask({ role, userId, task: quickTask })) {
      return null;
    }
    const qtDoc = typeof quickTask.toJSON === 'function' ? quickTask.toJSON() : quickTask;
    qtDoc.type = 'quick';
    const reporterObj = quickTask.reporterId;

    const rId = typeof reporterObj === 'object' ? (reporterObj?._id || reporterObj?.id) : reporterObj;
    qtDoc.reporterId = rId ? String(rId) : (qtDoc.reporterId || '');
    qtDoc.reporterName = (typeof reporterObj === 'object' ? reporterObj?.name : null) || qtDoc.reporterName || 'System';
    qtDoc.reporterAvatar = (typeof reporterObj === 'object' ? reporterObj?.avatar : null) || qtDoc.reporterAvatar;

    if (Array.isArray(qtDoc.assigneeIds)) {
      qtDoc.assigneeIds = qtDoc.assigneeIds.map(a => {
        if (typeof a === 'object') return String(a._id || a.id || a);
        return String(a);
      }).filter(Boolean);
    }

    if (quickTask.assigneeIds?.length && typeof quickTask.assigneeIds[0] === 'object') {
      qtDoc.assigneeNames = quickTask.assigneeIds.map((u) => u?.name).filter(Boolean);
    }
    return qtDoc;
  }

  // 3. Try personal task
  const personalTask = await PersonalTask.findOne({ _id: taskId, userId: uid }).lean();
  if (personalTask) {
    personalTask.type = 'personal';
    personalTask.id = String(personalTask._id);
    return personalTask;
  }

  return null;
}

export async function updateTask({ companyId, workspaceId, userId, role, taskId, updates }) {
  const tenantId = companyId;
  const { Task, ActivityLog, Notification, Project } = await getTenantModels(companyId);
  let existing = await Task.findOne({ _id: taskId, tenantId, workspaceId });

  if (!existing && (role === 'admin' || role === 'super_admin')) {
    existing = await Task.findOne({ _id: taskId, tenantId });
  }

  if (!existing) return null;

  // Prevent non-managers from editing tasks with pending reassignment
  if (existing.isReassignPending && !['super_admin', 'admin', 'manager', 'team_leader'].includes(role)) {
    const err = new Error('Task is locked (reassignment pending)');
    err.statusCode = 403;
    err.code = 'REASSIGN_PENDING_LOCKED';
    throw err;
  }

  if (!taskModifyRoles(role, existing, userId)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  // Status change restriction & Workflow enforcement
  if (updates.status && updates.status !== existing.status) {
    const uid = strId(userId);
    const isAssignee = (existing.assigneeIds || []).some(id => strId(id) === uid);

    // User Requirement: 
    // If an assignee (non-manager) tries to move to 'done', force it to 'in_review'
    // and they MUST provide a remark.
    const isManagerOrAdmin = isAdminRole(role) || ['manager', 'team_leader'].includes(role);

    if (updates.status === 'done' && !isManagerOrAdmin) {
      updates.status = 'in_review';
      if (!updates.completionRemark && !existing.completionReview?.completionRemark) {
        const err = new Error('You must provide completion notes describing what you did.');
        err.statusCode = 400;
        err.code = 'COMPLETION_REMARK_REQUIRED';
        throw err;
      }
    }

    if (!isManagerOrAdmin && !isAssignee) {
      const project = await Project.findOne({ _id: existing.projectId, tenantId }).lean();
      const isReportingPerson = (project?.reportingPersonIds || []).some(id => strId(id) === uid);
      if (!isReportingPerson) {
        const err = new Error('Forbidden: Only the assignee or a reporting person can change task status');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_STATUS_CHANGE';
        throw err;
      }
    }
  }

  const { subtasks, dueDate, startDate, endDate, completionRemark, reviewRemark, rating, ...rest } = updates;
  const beforeAssigneeIds = mapIdList(existing.assigneeIds);
  const nextStatus = rest.status ?? existing.status;
  const previousStatus = existing.status;

  if (updates.repeatSchedule !== undefined) {
    if (updates.repeatSchedule === "Don't Repeat") {
      rest.isRecurring = false;
      rest.recurrenceRule = null;
    } else if (updates.repeatSchedule === "Every Day") {
      rest.isRecurring = true;
      rest.recurrenceRule = { frequency: 'daily', interval: 1 };
    } else if (updates.repeatSchedule === "Every Week") {
      rest.isRecurring = true;
      rest.recurrenceRule = { frequency: 'weekly', interval: 1 };
    } else if (updates.repeatSchedule === "Every Month") {
      rest.isRecurring = true;
      rest.recurrenceRule = { frequency: 'monthly', interval: 1 };
    }
  }

  const $set = { ...rest };
  delete $set.type;
  if (dueDate !== undefined) $set.dueDate = dueDate ? new Date(dueDate) : null;
  if (endDate !== undefined) $set.dueDate = endDate ? new Date(endDate) : null;
  if (startDate !== undefined) $set.startDate = startDate ? new Date(startDate) : null;
  if (rest.phaseId !== undefined) $set.phaseId = rest.phaseId || null;
  if (rest.dependencies !== undefined) $set.dependencies = Array.isArray(rest.dependencies) ? rest.dependencies : [];
  if (rest.type !== undefined) $set.timelineType = rest.type;
  if (subtasks !== undefined) $set.subtasks = subtasks;
  if (rest.tags !== undefined) $set.tags = Array.isArray(rest.tags) ? rest.tags : [];
  if (rest.labels !== undefined) $set.labels = Array.isArray(rest.labels) ? rest.labels : [];
  if (rest.assigneeIds !== undefined) {
    $set.assigneeIds = Array.isArray(rest.assigneeIds) ? rest.assigneeIds : [];
  }
  if (rest.assigneeIds !== undefined && strId(beforeAssigneeIds) !== strId($set.assigneeIds)) {
    await logTaskActivity({
      tenantId,
      taskId,
      userId,
      action: 'ASSIGNED',
      oldValue: beforeAssigneeIds.join(', '),
      newValue: $set.assigneeIds.join(', '),
      message: `Updated assignees to ${$set.assigneeIds.length} people`
    });
  }

  if (completionRemark !== undefined || reviewRemark !== undefined || rating !== undefined || rest.status !== undefined) {
    $set.completionReview = buildCompletionState({
      existingReview: existing.completionReview,
      existingStatus: existing.status,
      nextStatus,
      updates: { completionRemark, reviewRemark, rating },
      userId,
    });
  }

  const task = await Task.findOneAndUpdate({ _id: taskId, tenantId }, { $set }, { new: true });
  if (!task) return null;

  const specializedOnlyFields = new Set(['status', 'assigneeIds', 'type', 'completionRemark']);
  const actualGenericChanges = [];
  for (const field of Object.keys(updates || {})) {
    if (specializedOnlyFields.has(field)) continue;

    let isChanged = false;
    const oldVal = existing[field];
    const newVal = updates[field];

    if (oldVal instanceof Date || newVal instanceof Date) {
      isChanged = new Date(oldVal || 0).getTime() !== new Date(newVal || 0).getTime();
    } else if (Array.isArray(oldVal) || Array.isArray(newVal)) {
      isChanged = JSON.stringify(oldVal || []) !== JSON.stringify(newVal || []);
    } else {
      isChanged = String(oldVal || '') !== String(newVal || '');
    }

    if (isChanged) actualGenericChanges.push(field);
  }

  const hasGenericTaskChanges = actualGenericChanges.length > 0;
  const activityEntries = [];

  if (hasGenericTaskChanges) {
    activityEntries.push({
      tenantId,
      workspaceId,
      userId,
      type: 'task_updated',
      description: `Updated task details: ${actualGenericChanges.join(', ')}`,
      entityType: 'task',
      entityId: task._id,
      metadata: { projectId: task.projectId, changedFields: actualGenericChanges },
    });
  }

  if (previousStatus !== task.status) {
    await updateTaskStatusHistory({
      tenantId,
      taskId: task._id,
      userId,
      fromStatus: previousStatus,
      toStatus: task.status,
      type: 'project'
    });
    activityEntries.push({
      tenantId,
      workspaceId,
      userId,
      type: 'task_status_changed',
      description: `Changed status for "${task.title}" from "${previousStatus}" to "${task.status}"`,
      entityType: 'task',
      entityId: task._id,
      metadata: { projectId: task.projectId, from: previousStatus, to: task.status },
    });
  }

  const afterAssigneeIds = mapIdList(task.assigneeIds);
  if (beforeAssigneeIds.join(',') !== afterAssigneeIds.join(',')) {
    activityEntries.push({
      tenantId,
      workspaceId,
      userId,
      type: 'task_assignees_changed',
      description: `Updated assignees for "${task.title}"`,
      entityType: 'task',
      entityId: task._id,
      metadata: { from: beforeAssigneeIds, to: afterAssigneeIds, projectId: task.projectId },
    });
  }

  if (activityEntries.length) {
    await ActivityLog.insertMany(activityEntries);
  }

  const newlyAssignedIds = afterAssigneeIds.filter((assigneeId) => !beforeAssigneeIds.includes(assigneeId));
  
  if (updates.repeatSchedule && updates.repeatSchedule !== existing.repeatSchedule && updates.repeatSchedule !== "Don't Repeat") {
    const notifyIds = afterAssigneeIds.filter(id => id !== strId(userId));
    if (notifyIds.length > 0) {
      await Notification.insertMany(
        notifyIds.map((assigneeId) => ({
          tenantId,
          workspaceId,
          userId: assigneeId,
          type: 'task_updated',
          title: 'Task repetition updated',
          message: `"${task.title}" repetition set to ${updates.repeatSchedule}`,
          isRead: false,
          relatedId: String(task._id),
        }))
      );
    }
  }

  if (newlyAssignedIds.length) {
    await Notification.insertMany(
      newlyAssignedIds.map((assignee) => ({
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

    const project = await Project.findOne({ _id: task.projectId, tenantId, workspaceId: task.workspaceId || workspaceId }).select('name').lean();
    await sendTaskAssignmentEmails({
      tenantId,
      assigneeIds: newlyAssignedIds,
      actorId: userId,
      task,
      projectName: project?.name || 'Untitled Project',
    });
  }

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

  await syncProjectStats(companyId, workspaceId, task.projectId);

  return (await attachTaskActivity({ companyId, workspaceId, tasks: [task] }))[0];
}

export async function moveTaskStatus({ companyId, workspaceId, userId, role, taskId, status }) {
  return updateTask({ companyId, workspaceId, userId, role, taskId, updates: { status } });
}

export async function reviewTaskCompletion({ companyId, workspaceId, userId, role, taskId, action, reviewRemark, rating }) {
  const tenantId = companyId;
  const { Task, ActivityLog } = await getTenantModels(companyId);
  const task = await Task.findOne({
    _id: taskId,
    tenantId,
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

  if (task.status !== 'done' && task.status !== 'in_review') {
    const err = new Error('Only completed or in-review tasks can be reviewed');
    err.statusCode = 400;
    err.code = 'INVALID_STATE';
    throw err;
  }

  if (action === 'approve' && !(typeof rating === 'number' && rating >= 1 && rating <= 5)) {
    const err = new Error('A rating between 1 and 5 is required to approve a completed task');
    err.statusCode = 400;
    err.code = 'RATING_REQUIRED';
    throw err;
  }

  const nextReviewStatus = action === 'approve' ? 'approved' : 'changes_requested';
  task.completionReview = {
    ...defaultCompletionReview(),
    ...(task.completionReview?.toObject?.() || task.completionReview || {}),
    reviewStatus: nextReviewStatus,
    rating: action === 'approve' ? rating : null,
    reviewRemark: reviewRemark || '',
    reviewedAt: new Date(),
    reviewedBy: userId,
  };

  if (action === 'approve') {
    task.status = 'done';
  } else if (action === 'changes_requested') {
    task.status = 'in_progress'; // Send back to in_progress for changes
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

  await syncProjectStats(companyId, workspaceId, task.projectId);

  return (await attachTaskActivity({ companyId, workspaceId, tasks: [task] }))[0];
}

export async function deleteTask({ companyId, workspaceId, userId, role, taskId }) {
  const tenantId = companyId;
  const { Task, Project, ActivityLog } = await getTenantModels(companyId);
  const existing = await Task.findOne({
    _id: taskId,
    tenantId,
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

  await syncProjectStats(companyId, workspaceId, task.projectId);

  return task;
}

export async function addSubtask({ companyId, workspaceId, userId, role, taskId, title, isCompleted, assigneeId }) {
  const tenantId = companyId;
  const mongoose = (await import('mongoose')).default;
  const { Task } = await getTenantModels(companyId);
  const task = await Task.findOne({
    _id: taskId,
    tenantId,
  });
  if (!task) return null;

  // Reassignment pending lock
  if (task.isReassignPending && !['super_admin', 'admin', 'manager', 'team_leader'].includes(role)) {
    const err = new Error('Subtask update locked (reassignment pending)');
    err.statusCode = 403;
    err.code = 'REASSIGN_PENDING_LOCKED';
    throw err;
  }

  if (!taskModifyRoles(role, task, userId)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const order = (task.subtasks?.length || 0) + 1;
  const subAssignee = assigneeId && mongoose.Types.ObjectId.isValid(assigneeId) ? new mongoose.Types.ObjectId(assigneeId) : null;
  task.subtasks.push({ title, isCompleted: Boolean(isCompleted), order, assigneeId: subAssignee });
  await task.save();

  await logTaskActivity({
    tenantId,
    taskId: task._id,
    userId,
    action: 'SUBTASK_ADDED',
    newValue: title,
    message: `added subtask: "${title}"`
  });

  const { ActivityLog: ActivityLogModel } = await getTenantModels(tenantId);
  await ActivityLogModel.create({
    tenantId,
    workspaceId,
    userId,
    type: 'subtask_added',
    description: `Added subtask "${title}" to "${task.title}"`,
    entityType: 'TASK',
    entityId: task._id,
    metadata: { projectId: task.projectId, subtaskTitle: title },
  });

  if (subAssignee) {
    await createSubtaskNotification({
      tenantId,
      workspaceId,
      assigneeId: subAssignee,
      taskTitle: task.title,
      subtaskTitle: title,
      taskId,
    });
  }

  await syncProjectStats(companyId, workspaceId, task.projectId);
  return task;
}

export async function updateSubtask({ companyId, workspaceId, userId, role, taskId, subtaskId, updates }) {
  const tenantId = companyId;
  const { Task } = await getTenantModels(companyId);
  const task = await Task.findOne({
    _id: taskId,
    tenantId,
  });
  if (!task) return null;

  // Reassignment pending lock
  if (task.isReassignPending && !['super_admin', 'admin', 'manager', 'team_leader'].includes(role)) {
    const err = new Error('Subtask update locked (reassignment pending)');
    err.statusCode = 403;
    err.code = 'REASSIGN_PENDING_LOCKED';
    throw err;
  }

  if (!taskModifyRoles(role, task, userId)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const sub = task.subtasks.id(subtaskId);
  if (!sub) return null;
  const prevAssignee = sub.assigneeId ? String(sub.assigneeId) : null;
  if (updates.isCompleted !== undefined && updates.isCompleted !== sub.isCompleted) {
    const { ActivityLog: ActivityLogModel } = await getTenantModels(tenantId);
    await ActivityLogModel.create({
      tenantId,
      workspaceId,
      userId,
      type: 'subtask_status_changed',
      description: `Marked subtask "${sub.title}" as ${updates.isCompleted ? 'completed' : 'uncompleted'} in task "${task.title}"`,
      entityType: 'TASK',
      entityId: taskId,
      metadata: { projectId: task.projectId, subtaskTitle: sub.title, isCompleted: updates.isCompleted },
    });
  }

  if (updates.title !== undefined) sub.title = updates.title;
  if (updates.isCompleted !== undefined) sub.isCompleted = Boolean(updates.isCompleted);
  if (updates.order !== undefined) sub.order = updates.order;
  if (updates.assigneeId !== undefined) {
    sub.assigneeId = updates.assigneeId && mongoose.Types.ObjectId.isValid(updates.assigneeId) ? new mongoose.Types.ObjectId(updates.assigneeId) : null;
  }
  await task.save();

  const newAssignee = sub.assigneeId ? String(sub.assigneeId) : null;
  if (newAssignee && newAssignee !== prevAssignee) {
    await createSubtaskNotification({
      tenantId,
      workspaceId,
      assigneeId: sub.assigneeId,
      taskTitle: task.title,
      subtaskTitle: sub.title,
      taskId,
    });
  }

  const { ActivityLog: ActivityLogModel } = await getTenantModels(tenantId);
  if (newAssignee && newAssignee !== prevAssignee) {
    await ActivityLogModel.create({
      tenantId,
      workspaceId,
      userId,
      type: 'subtask_assignee_changed',
      description: `Changed assignee for subtask "${sub.title}" in task "${task.title}"`,
      entityType: 'TASK',
      entityId: taskId,
      metadata: { projectId: task.projectId, subtaskTitle: sub.title },
    });
  }

  await syncProjectStats(companyId, workspaceId, task.projectId);
  return task;
}

export async function removeSubtask({ companyId, workspaceId, userId, role, taskId, subtaskId }) {
  const tenantId = companyId;
  const { Task } = await getTenantModels(companyId);
  const task = await Task.findOne({
    _id: taskId,
    tenantId,
  });
  if (!task) return null;

  // Reassignment pending lock
  if (task.isReassignPending && !['super_admin', 'admin', 'manager', 'team_leader'].includes(role)) {
    const err = new Error('Subtask removal locked (reassignment pending)');
    err.statusCode = 403;
    err.code = 'REASSIGN_PENDING_LOCKED';
    throw err;
  }

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
  await syncProjectStats(companyId, workspaceId, task.projectId);
  return task;
}

export async function addTaskAttachments({ companyId, workspaceId, userId, role, taskId, files, requestBaseUrl }) {
  const tenantId = companyId;
  const { Task } = await getTenantModels(companyId);

  const task = await Task.findOne({
    _id: taskId,
    tenantId,
  });
  if (!task) return null;

  if (!taskModifyRoles(role, task, userId)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const uploadedFiles = await uploadIncomingFiles({
    files,
    requestBaseUrl,
    category: 'task-attachments',
    entityId: taskId,
  });

  const attachments = uploadedFiles.map((u, i) => ({
    name: u.name || files[i].originalname,
    url: u.url,
    size: files[i].size,
    type: u.type,
    uploadedBy: userId,
    storageProvider: u.storageProvider,
    objectKey: u.objectKey,
  }));

  if (!attachments.length) return task;

  await Task.updateOne({ _id: taskId, tenantId, workspaceId }, { $push: { attachments: { $each: attachments } } });

  for (const attachment of attachments) {
    await logTaskActivity({
      tenantId,
      taskId: taskId,
      userId,
      action: 'ATTACHMENT_ADDED',
      newValue: attachment.name,
      message: `added attachment: "${attachment.name}"`
    });
  }

  const { ActivityLog: ActivityLogModel } = await getTenantModels(tenantId);
  await ActivityLogModel.create({
    tenantId,
    workspaceId,
    userId,
    type: 'attachment_added',
    description: `Added ${attachments.length} attachment(s) to "${task.title}"`,
    entityType: 'TASK',
    entityId: taskId,
    metadata: { projectId: task.projectId, count: attachments.length },
  });
  return Task.findOne({ _id: taskId, tenantId, workspaceId });
}

export async function addTaskComment({ companyId, workspaceId, userId, role, taskId, content }) {
  const tenantId = companyId;
  const { Task, Label, User } = await getTenantModels(companyId);

  const task = await Task.findOne({
    _id: taskId,
    tenantId,
  });
  if (!task) return null;

  if (!taskModifyRoles(role, task, userId)) {
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

  // 1. Ensure "Comment" label exists and add it
  let commentLabel = await Label.findOne({ tenantId, workspaceId, name: 'Comment' });
  if (!commentLabel) {
    try {
      commentLabel = await Label.create({
        tenantId,
        workspaceId,
        name: 'Comment',
        color: '#3b82f6',
      });
    } catch (e) {
      // If concurrent creation failed due to unique index, find it
      commentLabel = await Label.findOne({ tenantId, workspaceId, name: 'Comment' });
    }
  }

  const update = {
    $push: { comments: comment },
  };

  if (commentLabel && (!task.labels || !task.labels.some(l => String(l) === String(commentLabel._id)))) {
    update.$addToSet = { labels: commentLabel._id };
  }

  await Task.updateOne({ _id: taskId, tenantId }, update);

  await logTaskActivity({
    tenantId,
    taskId: taskId,
    userId,
    action: 'COMMENT_ADDED',
    message: `added a comment`
  });

  const { ActivityLog: ActivityLogModel } = await getTenantModels(tenantId);
  await ActivityLogModel.create({
    tenantId,
    workspaceId: task.workspaceId,
    userId,
    type: 'COMMENT_ADDED',
    description: `Commented on "${task.title}": ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
    entityType: 'TASK',
    entityId: taskId,
    metadata: { projectId: task.projectId },
  });

  // 2. Notifications
  const sender = await User.findById(userId).select('name').lean();
  const recipients = new Set();
  if (task.reporterId && String(task.reporterId) !== String(userId)) recipients.add(String(task.reporterId));
  (task.assigneeIds || []).forEach(aid => {
    if (aid && String(aid) !== String(userId)) recipients.add(String(aid));
  });

  if (recipients.size > 0) {
    await notifyUsers({
      tenantId,
      workspaceId: task.workspaceId,
      userIds: Array.from(recipients),
      type: 'comment_added',
      title: 'New comment on task',
      message: `${sender?.name || 'Someone'} commented on "${task.title}": ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
      relatedId: taskId,
    });
  }

  return Task.findOne({ _id: taskId, tenantId })
    .populate('assigneeIds', 'name avatar color fontColor')
    .populate('reporterId', 'name avatar color fontColor')
    .populate('projectId', 'name')
    .populate('labels')
    .populate('subtasks.assigneeId', 'name avatar color fontColor');
}

export async function getOverdueTasks({ tenantId, workspaceId, userId, role }) {
  const { Task, QuickTask, Project } = await getTenantModels(tenantId);
  const now = new Date();

  const allowedProjects = await getAccessibleProjectIds({ tenantId, workspaceId, userId, role });

  // 1. Project Tasks Filter
  const taskFilter = {
    tenantId,
    workspaceId,
    ...getOverdueQueryFilter(now),
    $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }],
  };

  // Exclude tasks from archived projects
  const archivedProjects = await Project.find({ tenantId, workspaceId, status: 'archived' }).select('_id').lean();
  if (archivedProjects.length > 0) {
    const archivedIds = archivedProjects.map(p => p._id);
    if (taskFilter.$and) {
      taskFilter.$and.push({ projectId: { $nin: archivedIds } });
    } else {
      taskFilter.$and = [{ projectId: { $nin: archivedIds } }];
    }
  }

  if (allowedProjects !== null) {
    const projectAccessFilter = {
      $or: [
        ...(allowedProjects.length ? [{ projectId: { $in: allowedProjects } }] : []),
        buildDirectTaskAccessFilter(userId),
      ],
    };
    if (taskFilter.$and) {
      taskFilter.$and.push(projectAccessFilter);
    } else {
      taskFilter.$and = [projectAccessFilter];
    }
  }

  // 2. Quick Tasks Filter
  const quickTaskFilter = {
    tenantId,
    workspaceId,
    ...getOverdueQueryFilter(now),
  };

  if (!isAdminRole(role)) {
    if (['manager', 'team_leader'].includes(role)) {
      // Managers see all public, and their own private
      quickTaskFilter.$or = [
        { isPrivate: false },
        { reporterId: userId },
        { createdBy: userId },
        { assigneeIds: userId }
      ];
    } else {
      // Others only see where they are involved
      quickTaskFilter.$or = [
        { reporterId: userId },
        { createdBy: userId },
        { assigneeIds: userId }
      ];
    }
  }

  // Fetch both types of tasks
  const [tasks, qTasks] = await Promise.all([
    Task.find(taskFilter).populate('assigneeIds', 'name').sort({ dueDate: 1 }).lean(),
    QuickTask.find(quickTaskFilter).populate('assigneeIds', 'name').sort({ dueDate: 1 }).lean()
  ]);

  const allFilteredTasks = [...tasks, ...qTasks];

  const formattedTasks = allFilteredTasks
    .map((t) => ({
      id: String(t._id),
      title: t.title,
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : null,
      assignedToName:
        t.assigneeIds && t.assigneeIds.length > 0
          ? t.assigneeIds.map((u) => u.name).join(', ')
          : 'Unassigned',
      type: tasks.some(pt => String(pt._id) === String(t._id)) ? 'project' : 'quick'
    }))
    .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime());

  return {
    count: formattedTasks.length,
    tasks: formattedTasks,
  };
}

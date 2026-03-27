import mongoose from 'mongoose';
import { getTenantModels } from '../config/tenantDb.js';
import { sendTemplatedEmailSafe } from './mail.service.js';
import { syncProjectStats } from './project.service.js';

function strId(x) {
  return x ? String(x) : '';
}

function isAdminRole(role) {
  return role === 'super_admin' || role === 'admin';
}

function hasFullProjectAccess(role) {
  return isAdminRole(role) || role === 'manager';
}

/** @returns {Promise<mongoose.Types.ObjectId[]|null>} null = all projects allowed */
export async function getAccessibleProjectIds({ tenantId, workspaceId, userId, role }) {
  const { Project, Team } = await getTenantModels(tenantId);
  if (hasFullProjectAccess(role)) return null;

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
    review.rating = null;
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
  if (isAdminRole(role) || ['manager', 'team_leader'].includes(role)) return true;
  const uid = strId(userId);
  if (strId(task.reporterId) === uid) return true;
  return reviewerIds.includes(uid);
}

function mapTaskWithActivity(task, activityHistory) {
  const json = typeof task?.toJSON === 'function' ? task.toJSON() : task;
  return {
    ...json,
    activityHistory: Array.isArray(activityHistory) ? activityHistory : [],
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
  const { Task } = await getTenantModels(companyId);
  const filter = {
    tenantId,
    workspaceId,
    $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }],
  };

  const allowed = await getAccessibleProjectIds({ tenantId, workspaceId, userId, role });
  if (allowed !== null) {
    if (projectId) {
      filter.projectId = projectId;
      if (!allowed.some((id) => strId(id) === strId(projectId))) {
        Object.assign(filter, buildDirectTaskAccessFilter(userId));
      }
    } else {
      filter.$and = [
        { $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }] },
        {
          $or: [
            ...(allowed.length ? [{ projectId: { $in: allowed } }] : []),
            buildDirectTaskAccessFilter(userId),
          ],
        },
      ];
      delete filter.$or;
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
  return { items: await attachTaskActivity({ companyId, workspaceId, tasks: items }), total, page, limit };
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

  const { Task, Project, ActivityLog, Notification } = await getTenantModels(companyId);
  const project = await Project.findOne({ _id: data.projectId, tenantId, workspaceId }).select('name').lean();
  const rawDurationDays = Number(data.durationDays);
  if (!Number.isFinite(rawDurationDays) || rawDurationDays < 1) {
    const err = new Error('Task duration is required.');
    err.statusCode = 400;
    err.code = 'TASK_DURATION_REQUIRED';
    throw err;
  }
  const durationDays = Math.max(1, Math.round(rawDurationDays));

  const startDate = data.startDate ? new Date(data.startDate) : new Date();
  const dueDate = addDaysUtc(startDate, durationDays - 1);
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
    startDate,
    dueDate,
    duration: durationDays * 24 * 60,
    phaseId: data.phaseId || null,
    dependencies: Array.isArray(data.dependencies) ? data.dependencies : [],
    timelineType: data.type || 'task',
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

 export async function getTaskById({ companyId, workspaceId, userId, role, taskId }) {
   const tenantId = companyId;
   const { Task } = await getTenantModels(companyId);
   
   // Try strict lookup first
   let task = await Task.findOne({ _id: taskId, tenantId, workspaceId });
   
   // Admin fallback: handle metadata/workspace mismatches
   if (!task && (role === 'admin' || role === 'super_admin')) {
     task = await Task.findOne({ _id: taskId, tenantId });
   }
   
   if (!task) return null;
   
   // Use the task's actual workspaceId for project access check
   const ok = await assertProjectAccess({ tenantId, workspaceId: task.workspaceId, userId, role, projectId: task.projectId });
   if (!ok && !taskModifyRoles(role, task, userId)) return null;
   return (await attachTaskActivity({ companyId, workspaceId: task.workspaceId, tasks: [task] }))[0];
 }

export async function getAnyTaskById({ companyId, workspaceId, userId, role, taskId }) {
   if (!mongoose.Types.ObjectId.isValid(taskId)) return null;
   
   // Try project task
   const task = await getTaskById({ companyId, workspaceId, userId, role, taskId });
   if (task) {
     const t = task.toJSON();
     t.type = 'project';
     return t;
   }
   
   // Try quick task
   const { QuickTask } = await getTenantModels(companyId);
   // Fallback: search by ID and tenant only to avoid workspace metadata mismatches
   const quickTask = await QuickTask.findOne({ _id: taskId, tenantId: companyId });
   
   if (quickTask) {
     if (!canViewQuickTask({ role, userId, task: quickTask })) {
       return null;
     }
     const qt = quickTask.toJSON();
     qt.type = 'quick';
     return qt;
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

  const { subtasks, dueDate, startDate, endDate, completionRemark, ...rest } = updates;
  const beforeAssigneeIds = mapIdList(existing.assigneeIds);
  const nextStatus = rest.status ?? existing.status;
  const previousStatus = existing.status;
  const $set = { ...rest };
  delete $set.type;
  if (dueDate !== undefined) $set.dueDate = dueDate ? new Date(dueDate) : null;
  if (endDate !== undefined) $set.dueDate = endDate ? new Date(endDate) : null;
  if (startDate !== undefined) $set.startDate = startDate ? new Date(startDate) : null;
  if (rest.phaseId !== undefined) $set.phaseId = rest.phaseId || null;
  if (rest.dependencies !== undefined) $set.dependencies = Array.isArray(rest.dependencies) ? rest.dependencies : [];
  if (rest.type !== undefined) $set.timelineType = rest.type;
  if (subtasks !== undefined) $set.subtasks = subtasks;
  if (rest.assigneeIds !== undefined) {
    $set.assigneeIds = Array.isArray(rest.assigneeIds) ? rest.assigneeIds : [];
  }
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

  const activityEntries = [{
    tenantId,
    workspaceId,
    userId,
    type: 'task_updated',
    description: `Updated task "${task.title}"`,
    entityType: 'task',
    entityId: task._id,
    metadata: { projectId: task.projectId },
  }];

  if (previousStatus !== task.status) {
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

  await ActivityLog.insertMany(activityEntries);

  const newlyAssignedIds = afterAssigneeIds.filter((assigneeId) => !beforeAssigneeIds.includes(assigneeId));
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

  if (task.status !== 'done') {
    const err = new Error('Only completed tasks can be reviewed');
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

export async function addSubtask({ companyId, workspaceId, userId, role, taskId, title, isCompleted }) {
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

  const order = (task.subtasks?.length || 0) + 1;
  task.subtasks.push({ title, isCompleted: Boolean(isCompleted), order });
  await task.save();
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
  if (updates.title !== undefined) sub.title = updates.title;
  if (updates.isCompleted !== undefined) sub.isCompleted = Boolean(updates.isCompleted);
  if (updates.order !== undefined) sub.order = updates.order;
  await task.save();
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
 
 export async function addTaskComment({ companyId, workspaceId, userId, role, taskId, content }) {
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
 
   const comment = {
     content,
     authorId: userId,
     createdAt: new Date(),
     updatedAt: new Date(),
   };
 
   await Task.updateOne({ _id: taskId, tenantId, workspaceId }, { $push: { comments: comment } });
   return Task.findOne({ _id: taskId, tenantId, workspaceId });
 }

import { getTenantModels } from '../config/tenantDb.js';
import fs from 'fs';
import path from 'path';

const DEBUG_LOG_FILE = path.join(process.cwd(), 'debug-e243b9.log');
function fileAgentLog(payload) {
  try {
    fs.appendFileSync(DEBUG_LOG_FILE, JSON.stringify(payload) + '\n');
  } catch {
    // ignore logging errors
  }
}

export async function listQuickTasks({ companyId, workspaceId }) {
  const tenantId = companyId;
  const { QuickTask } = getTenantModels();
  return QuickTask.find({ tenantId, workspaceId }).sort({ updatedAt: -1 });
}

export async function createQuickTask({ companyId, workspaceId, userId, data }) {
  const tenantId = companyId;
  const { QuickTask, ActivityLog, Notification } = getTenantModels();

  // #region agent log
  fetch('http://127.0.0.1:7462/ingest/1ea124be-0e11-4062-90a0-e3d9902964d6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e243b9'},body:JSON.stringify({sessionId:'e243b9',runId:'pre-fix',hypothesisId:'H1',location:'server/src/services/quickTask.service.js:createQuickTask',message:'Creating quick task in DB',data:{tenantId:String(tenantId),workspaceId:String(workspaceId),reporterId:String(userId),assigneeIdsCount:Array.isArray(data?.assigneeIds)?data.assigneeIds.length:undefined,assigneeIdProvided:!!data?.assigneeId,status:data?.status,priority:data?.priority},timestamp:Date.now()})}).catch(()=>{});
  fileAgentLog({ sessionId: 'e243b9', runId: 'pre-fix', hypothesisId: 'H1', location: 'server/src/services/quickTask.service.js:createQuickTask', message: 'Creating quick task in DB', data: { tenantId: String(tenantId), workspaceId: String(workspaceId), reporterId: String(userId), assigneeIdsCount: Array.isArray(data?.assigneeIds) ? data.assigneeIds.length : undefined, assigneeIdProvided: !!data?.assigneeId, status: data?.status, priority: data?.priority }, timestamp: Date.now() });
  // #endregion

  const assigneeIds = Array.isArray(data.assigneeIds)
    ? data.assigneeIds
    : data.assigneeId
      ? [data.assigneeId]
      : [];

  const qt = await QuickTask.create({
    tenantId,
    workspaceId,
    title: data.title,
    description: data.description,
    status: data.status || 'todo',
    priority: data.priority || 'medium',
    assigneeIds,
    reporterId: userId,
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
  });

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

  if (assigneeIds.length) {
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

export async function updateQuickTask({ companyId, workspaceId, userId, id, updates }) {
  const tenantId = companyId;
  const { QuickTask, ActivityLog, Notification } = getTenantModels();

  const existing = await QuickTask.findOne({ _id: id, tenantId, workspaceId });
  if (!existing) return null;

  const beforeAssignees = existing.assigneeIds || [];

  const assigneeIds =
    updates.assigneeIds !== undefined
      ? updates.assigneeIds
      : updates.assigneeId !== undefined
        ? [updates.assigneeId]
        : undefined;

  const $set = {
    ...updates,
    ...(updates.dueDate !== undefined ? { dueDate: updates.dueDate ? new Date(updates.dueDate) : null } : {}),
  };

  if (assigneeIds !== undefined) {
    $set.assigneeIds = assigneeIds;
    delete $set.assigneeId;
  }

  const qt = await QuickTask.findOneAndUpdate({ _id: id, tenantId, workspaceId }, { $set }, { new: true });
  if (!qt) return null;

  await ActivityLog.create({
    tenantId,
    workspaceId,
    userId,
    type: 'quick_task_updated',
    description: `Updated quick task "${qt.title}"`,
    entityType: 'quick_task',
    entityId: qt._id,
    metadata: {},
  });

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

  return qt;
}

export async function deleteQuickTask({ companyId, workspaceId, userId, id }) {
  const tenantId = companyId;
  const { QuickTask, ActivityLog } = getTenantModels();
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
  const { QuickTask, Notification } = getTenantModels();

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

  return updated;
}

export async function addQuickTaskAttachments({ companyId, workspaceId, userId, role, taskId, files, requestBaseUrl }) {
  const tenantId = companyId;
  const { QuickTask } = getTenantModels();

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
  return QuickTask.findOne({ _id: taskId, tenantId, workspaceId });
}


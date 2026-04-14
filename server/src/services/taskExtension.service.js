import { getTenantModels } from '../config/tenantDb.js';

/**
 * Creates a new extension request or just logs an explanation for overdue tasks.
 */
export async function createExtensionRequest({ companyId, workspaceId, userId, data }) {
  const { Task, ExtensionRequest, ActivityLog, Notification, Project } = await getTenantModels(companyId);
  
  const { taskIds, reason, requestedDueDate, isExplanationOnly } = data;

  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    throw new Error('Task IDs are required');
  }

  // Validate tasks
  const tasks = await Task.find({ _id: { $in: taskIds }, tenantId: companyId }).populate('projectId').lean();
  if (tasks.length === 0) {
    throw new Error('No valid tasks found');
  }

  // Validate due date if not explanation only
  if (!isExplanationOnly) {
    if (!requestedDueDate) throw new Error('Requested due date is required for extension');
    const newDate = new Date(requestedDueDate);
    if (newDate <= new Date()) {
      throw new Error('Requested due date must be in the future');
    }

    // Check for duplicate pending requests
    const existing = await ExtensionRequest.findOne({
      tenantId: companyId,
      taskIds: { $in: taskIds },
      status: 'pending'
    });
    if (existing) {
      throw new Error('An extension request is already pending for one or more of these tasks.');
    }
  }

  // Store in Activity Log for each task
  for (const task of tasks) {
    await ActivityLog.create({
      tenantId: companyId,
      workspaceId,
      userId,
      type: isExplanationOnly ? 'OVERDUE_EXPLANATION' : 'EXTENSION_REQUEST',
      description: isExplanationOnly 
        ? `Sent overdue explanation: ${reason}` 
        : `Requested extension to ${new Date(requestedDueDate).toLocaleDateString()}: ${reason}`,
      entityType: 'task',
      entityId: task._id,
      metadata: { reason, requestedDueDate, isExplanationOnly }
    });
  }

  // Update Task fields for quick reference
  await Task.updateMany(
    { _id: { $in: taskIds } },
    { 
      $set: { 
        extensionStatus: isExplanationOnly ? 'none' : 'pending',
        latestExtensionReason: reason,
        latestRequestedDueDate: isExplanationOnly ? null : requestedDueDate
      } 
    }
  );

  let request = null;
  if (!isExplanationOnly) {
    // Determine reviewer: use first task's reporter or project reporting person
    const firstTask = tasks[0];
    const project = await Project.findById(firstTask.projectId).lean();
    const reviewerId = (project?.reportingPersonIds && project.reportingPersonIds[0]) || firstTask.reporterId;

    request = await ExtensionRequest.create({
      tenantId: companyId,
      userId,
      taskIds,
      reason,
      requestedDueDate,
      status: 'pending',
      reviewerId: reviewerId || null
    });

    // Notify reviewer
    if (reviewerId) {
      await Notification.create({
        tenantId: companyId,
        workspaceId,
        userId: reviewerId,
        type: 'extension_request_created',
        title: 'New Extension Request',
        message: `Task extension requested for ${tasks.length} task(s).`,
        relatedId: String(request._id),
        isRead: false
      });
    }
  }

  return request;
}

/**
 * Approves an extension request and updates the tasks.
 */
export async function approveExtensionRequest({ companyId, workspaceId, userId, requestId, comment }) {
  const { Task, ExtensionRequest, Notification, ActivityLog } = await getTenantModels(companyId);
  
  const request = await ExtensionRequest.findOne({ _id: requestId, tenantId: companyId });
  if (!request) throw new Error('Request not found');
  if (request.status !== 'pending') throw new Error('Request already processed');

  request.status = 'approved';
  request.reviewerId = userId;
  request.reviewerComment = comment || '';
  await request.save();

  // Update all selected tasks
  await Task.updateMany(
    { _id: { $in: request.taskIds } },
    { 
      $set: { 
        dueDate: request.requestedDueDate,
        isOverdue: false,
        overdueSince: null,
        extensionStatus: 'approved'
      } 
    }
  );

  // Notify Assignee
  await Notification.create({
    tenantId: companyId,
    workspaceId,
    userId: request.userId,
    type: 'extension_request_approved',
    title: 'Extension Request Approved',
    message: `Your extension request was approved.`,
    relatedId: String(request._id),
    isRead: false
  });

  // Log activity for each task
  for (const taskId of request.taskIds) {
    await ActivityLog.create({
      tenantId: companyId,
      workspaceId,
      userId,
      type: 'EXTENSION_APPROVED',
      description: `Approved extension request to ${new Date(request.requestedDueDate).toLocaleDateString()}`,
      entityType: 'task',
      entityId: taskId,
      metadata: { requestId: request._id, comment }
    });
  }

  return request;
}

/**
 * Rejects an extension request.
 */
export async function rejectExtensionRequest({ companyId, workspaceId, userId, requestId, comment }) {
  if (!comment) throw new Error('Comment is mandatory on rejection');

  const { ExtensionRequest, Notification, ActivityLog } = await getTenantModels(companyId);
  
  const request = await ExtensionRequest.findOne({ _id: requestId, tenantId: companyId });
  if (!request) throw new Error('Request not found');
  if (request.status !== 'pending') throw new Error('Request already processed');

  request.status = 'rejected';
  request.reviewerId = userId;
  request.reviewerComment = comment;
  await request.save();

  // Update tasks
  await Task.updateMany(
    { _id: { $in: request.taskIds } },
    { $set: { extensionStatus: 'rejected' } }
  );

  // Notify Assignee
  await Notification.create({
    tenantId: companyId,
    workspaceId,
    userId: request.userId,
    type: 'extension_request_rejected',
    title: 'Extension Request Rejected',
    message: `Your extension request was rejected.`,
    relatedId: String(request._id),
    isRead: false
  });

  // Log activity for each task
  for (const taskId of request.taskIds) {
    await ActivityLog.create({
      tenantId: companyId,
      workspaceId,
      userId,
      type: 'EXTENSION_REJECTED',
      description: `Rejected extension request: ${comment}`,
      entityType: 'task',
      entityId: taskId,
      metadata: { requestId: request._id, comment }
    });
  }

  return request;
}

/**
 * Lists extension requests based on user role and ID.
 */
export async function listExtensionRequests({ companyId, workspaceId, userId, role }) {
  const { ExtensionRequest, Task, User } = await getTenantModels(companyId);
  
  const filter = { tenantId: companyId };
  if (role !== 'admin' && role !== 'super_admin' && role !== 'manager' && role !== 'team_leader') {
    filter.$or = [
      { userId: userId },
      { reviewerId: userId }
    ];
  }

  const requests = await ExtensionRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate('userId', 'name email avatar')
    .populate('reviewerId', 'name email avatar')
    .lean();

  // Optionally populate tasks names
  for (const request of requests) {
    const tasks = await Task.find({ _id: { $in: request.taskIds } }).select('title dueDate').lean();
    request.tasks = tasks.map(t => ({ id: String(t._id), title: t.title, originalDueDate: t.dueDate }));
  }

  return requests;
}

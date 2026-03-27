import { getTenantModels } from '../config/tenantDb.js';

export async function createReassignRequest({ companyId, userId, taskId, requestedAssigneeId, note }) {
  const { Task, TaskReassignRequest, ActivityLog, Notification } = await getTenantModels(companyId);
  
  const task = await Task.findById(taskId);
  if (!task) throw new Error('Task not found');

  // We take the first assignee as the current assignee for the request context
  const currentAssigneeId = task.assigneeIds && task.assigneeIds.length > 0 ? task.assigneeIds[0] : userId;
  
  const request = await TaskReassignRequest.create({
    tenantId: companyId,
    taskId,
    requestedBy: userId,
    currentAssigneeId,
    requestedAssigneeId,
    note,
    status: 'PENDING'
  });

  // Mark task as reassign pending
  task.isReassignPending = true;
  task.requestedAssigneeId = requestedAssigneeId;
  task.reassignRequestedBy = userId;
  await task.save();

  // Log activity
  await ActivityLog.create({
    tenantId: companyId,
    workspaceId: task.workspaceId,
    userId,
    type: 'task_reassign_requested',
    description: `Requested reassignment for "${task.title}"`,
    entityType: 'task',
    entityId: taskId,
    metadata: { note, requestedAssigneeId }
  });

  // Notify potential approvers (Managers/Admins in the same tenant/workspace)
  // Logic: Notify all users with role 'manager' or 'admin' in this tenant
  // For simplicity, we'll just create the request. Real notifications can be added.
  
  return request;
}

export async function getReassignRequests({ companyId, userId, role }) {
  const { TaskReassignRequest } = await getTenantModels(companyId);
  
  // Managers and Admins can see all pending requests
  if (!['super_admin', 'admin', 'manager', 'team_leader'].includes(role)) {
    // Regular employees only see their own requests
    return await TaskReassignRequest.find({ requestedBy: userId })
      .populate('taskId', 'title')
      .sort({ createdAt: -1 });
  }

  return await TaskReassignRequest.find({ status: 'PENDING' })
    .populate('taskId', 'title')
    .sort({ createdAt: -1 });
}

export async function handleReassignRequest({ companyId, userId, requestId, approve, rejectionNote }) {
  const { TaskReassignRequest, Task, ActivityLog, Notification } = await getTenantModels(companyId);
  
  const request = await TaskReassignRequest.findById(requestId);
  if (!request) throw new Error('Request not found');
  if (request.status !== 'PENDING') throw new Error('Request already processed');

  if (approve) {
    request.status = 'APPROVED';
    request.approvedBy = userId;
    
    // Perform the actual reassignment on the Task
    const task = await Task.findById(request.taskId);
    if (task) {
      // Replace assignee with the requested one
      task.assigneeIds = [request.requestedAssigneeId];
      task.isReassignPending = false;
      task.requestedAssigneeId = null;
      task.reassignRequestedBy = null;
      await task.save();
      
      await ActivityLog.create({
        tenantId: companyId,
        workspaceId: task.workspaceId,
        userId,
        type: 'task_reassigned',
        description: `Approved reassignment for "${task.title}"`,
        entityType: 'task',
        entityId: task._id,
        metadata: { oldAssignee: request.currentAssigneeId, newAssignee: request.requestedAssigneeId, requestId }
      });

      await Notification.create({
        tenantId: companyId,
        workspaceId: task.workspaceId,
        userId: request.requestedAssigneeId,
        type: 'task_assigned',
        title: 'Task assigned to you',
        message: `You were assigned "${task.title}" after reassignment approval.`,
        relatedId: String(task._id)
      });

      // Notify requester
      await Notification.create({
        tenantId: companyId,
        workspaceId: task.workspaceId,
        userId: request.requestedBy,
        type: 'task_assigned',
        title: 'Reassignment Approved',
        message: `Your request to reassign "${task.title}" has been approved.`,
        relatedId: String(task._id)
      });
    }
  } else {
    request.status = 'REJECTED';
    request.approvedBy = userId;
    request.rejectionNote = rejectionNote;

    const task = await Task.findById(request.taskId);
    if (task) {
        task.isReassignPending = false;
        task.requestedAssigneeId = null;
        task.reassignRequestedBy = null;
        await task.save();
        
        await Notification.create({
            tenantId: companyId,
            workspaceId: task.workspaceId,
            userId: request.requestedBy,
            type: 'mention',
            title: 'Reassignment Rejected',
            message: `Your request to reassign "${task.title}" was rejected. ${rejectionNote ? 'Reason: ' + rejectionNote : ''}`,
            relatedId: String(task._id)
          });
    }
  }

  await request.save();
  return request;
}

export async function getRequestStatusForTask({ companyId, taskId }) {
    const { TaskReassignRequest } = await getTenantModels(companyId);
    return await TaskReassignRequest.findOne({ taskId, status: 'PENDING' });
}

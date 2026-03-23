import * as TaskService from '../services/task.service.js';

export async function list(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const { projectId, assigneeId, status, priority, page, limit } = req.query;
    const result = await TaskService.listTasks({
      companyId,
      workspaceId,
      projectId,
      assigneeId,
      status,
      priority,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 200,
      userId,
      role,
    });
    return res.status(200).json({
      success: true,
      data: result.items,
      meta: { total: result.total, page: result.page, limit: result.limit },
    });
  } catch (e) {
    return next(e);
  }
}

export async function getOne(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const task = await TaskService.getTaskById({
      companyId,
      workspaceId,
      userId,
      role,
      taskId: req.params.id,
    });
    if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
    return res.status(200).json({ success: true, data: task });
  } catch (e) {
    return next(e);
  }
}

export async function create(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const task = await TaskService.createTask({ companyId, workspaceId, userId, role, data: req.body });
    return res.status(201).json({ success: true, data: task });
  } catch (e) {
    return next(e);
  }
}

export async function update(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const task = await TaskService.updateTask({
      companyId,
      workspaceId,
      userId,
      role,
      taskId: req.params.id,
      updates: req.body,
    });
    if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
    return res.status(200).json({ success: true, data: task });
  } catch (e) {
    return next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const task = await TaskService.deleteTask({ companyId, workspaceId, userId, role, taskId: req.params.id });
    if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
    return res.status(200).json({ success: true, data: { ok: true } });
  } catch (e) {
    return next(e);
  }
}

export async function moveStatus(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const task = await TaskService.moveTaskStatus({
      companyId,
      workspaceId,
      userId,
      role,
      taskId: req.params.id,
      status: req.body.status,
    });
    if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
    return res.status(200).json({ success: true, data: task });
  } catch (e) {
    return next(e);
  }
}

export async function reviewCompletion(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const task = await TaskService.reviewTaskCompletion({
      companyId,
      workspaceId,
      userId,
      role,
      taskId: req.params.id,
      action: req.body.action,
      reviewRemark: req.body.reviewRemark,
    });
    if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
    return res.status(200).json({ success: true, data: task });
  } catch (e) {
    return next(e);
  }
}

export async function addSubtask(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const task = await TaskService.addSubtask({
      companyId,
      workspaceId,
      userId,
      role,
      taskId: req.params.id,
      title: req.body.title,
    });
    if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
    return res.status(200).json({ success: true, data: task });
  } catch (e) {
    return next(e);
  }
}

export async function patchSubtask(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const task = await TaskService.updateSubtask({
      companyId,
      workspaceId,
      userId,
      role,
      taskId: req.params.id,
      subtaskId: req.params.subtaskId,
      updates: req.body,
    });
    if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task or subtask not found' } });
    return res.status(200).json({ success: true, data: task });
  } catch (e) {
    return next(e);
  }
}

export async function deleteSubtask(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const task = await TaskService.removeSubtask({
      companyId,
      workspaceId,
      userId,
      role,
      taskId: req.params.id,
      subtaskId: req.params.subtaskId,
    });
    if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task or subtask not found' } });
    return res.status(200).json({ success: true, data: task });
  } catch (e) {
    return next(e);
  }
}

export async function uploadAttachments(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const requestBaseUrl = `${req.protocol}://${req.get('host')}`;
    const task = await TaskService.addTaskAttachments({
      companyId,
      workspaceId,
      userId,
      role,
      taskId: req.params.id,
      files: req.files || [],
      requestBaseUrl,
    });

    if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
    return res.status(200).json({ success: true, data: task });
  } catch (e) {
    return next(e);
  }
}

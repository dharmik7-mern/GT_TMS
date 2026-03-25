import * as QuickTaskService from '../services/quickTask.service.js';
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

export async function list(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const items = await QuickTaskService.listQuickTasks({ companyId, workspaceId, userId, role });
    return res.status(200).json({ success: true, data: items });
  } catch (e) {
    return next(e);
  }
}

export async function create(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;

    // #region agent log
    fetch('http://127.0.0.1:7462/ingest/1ea124be-0e11-4062-90a0-e3d9902964d6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e243b9'},body:JSON.stringify({sessionId:'e243b9',runId:'pre-fix',hypothesisId:'H1',location:'server/src/controllers/quickTasks.controller.js:create',message:'QuickTask create called',data:{companyId:String(companyId),workspaceId:String(workspaceId),userId:String(userId),role,hasAssigneeIds:Array.isArray(req.body?.assigneeIds),assigneeIdsCount:Array.isArray(req.body?.assigneeIds)?req.body.assigneeIds.length:null,hasAssigneeId:!!req.body?.assigneeId,dueDate:!!req.body?.dueDate},timestamp:Date.now()})}).catch(()=>{});
    fileAgentLog({ sessionId: 'e243b9', runId: 'pre-fix', hypothesisId: 'H1', location: 'server/src/controllers/quickTasks.controller.js:create', message: 'QuickTask create called', data: { companyId: String(companyId), workspaceId: String(workspaceId), userId: String(userId), role, hasAssigneeIds: Array.isArray(req.body?.assigneeIds), assigneeIdsCount: Array.isArray(req.body?.assigneeIds) ? req.body.assigneeIds.length : null, hasAssigneeId: !!req.body?.assigneeId, dueDate: !!req.body?.dueDate }, timestamp: Date.now() });
    // #endregion

    const qt = await QuickTaskService.createQuickTask({ companyId, workspaceId, userId, data: req.body, role });
    return res.status(201).json({ success: true, data: qt });
  } catch (e) {
    // #region agent log
    fetch('http://127.0.0.1:7462/ingest/1ea124be-0e11-4062-90a0-e3d9902964d6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e243b9'},body:JSON.stringify({sessionId:'e243b9',runId:'pre-fix',hypothesisId:'H1',location:'server/src/controllers/quickTasks.controller.js:create',message:'QuickTask create failed',data:{errorCode:e?.code||null,message:e?.message||null},timestamp:Date.now()})}).catch(()=>{});
    fileAgentLog({ sessionId: 'e243b9', runId: 'pre-fix', hypothesisId: 'H1', location: 'server/src/controllers/quickTasks.controller.js:create', message: 'QuickTask create failed', data: { errorCode: e?.code || null, message: e?.message || null }, timestamp: Date.now() });
    // #endregion
    return next(e);
  }
}

export async function importBulk(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const result = await QuickTaskService.importQuickTasksBulk({
      companyId,
      workspaceId,
      userId,
      actorRole: role,
      rows: req.body?.rows || [],
    });
    return res.status(200).json({ success: true, data: result });
  } catch (e) {
    return next(e);
  }
}

export async function update(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;

    // #region agent log
    fetch('http://127.0.0.1:7462/ingest/1ea124be-0e11-4062-90a0-e3d9902964d6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e243b9'},body:JSON.stringify({sessionId:'e243b9',runId:'pre-fix',hypothesisId:'H1',location:'server/src/controllers/quickTasks.controller.js:update',message:'QuickTask update called',data:{companyId:String(companyId),workspaceId:String(workspaceId),userId:String(userId),role,taskId:req.params.id,assigneeIdsCount:Array.isArray(req.body?.assigneeIds)?req.body.assigneeIds.length:null,hasAssigneeId:!!req.body?.assigneeId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const qt = await QuickTaskService.updateQuickTask({ companyId, workspaceId, userId, role, id: req.params.id, updates: req.body });
    if (!qt) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Quick task not found' } });
    return res.status(200).json({ success: true, data: qt });
  } catch (e) {
    // #region agent log
    fetch('http://127.0.0.1:7462/ingest/1ea124be-0e11-4062-90a0-e3d9902964d6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e243b9'},body:JSON.stringify({sessionId:'e243b9',runId:'pre-fix',hypothesisId:'H1',location:'server/src/controllers/quickTasks.controller.js:update',message:'QuickTask update failed',data:{errorCode:e?.code||null,message:e?.message||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const qt = await QuickTaskService.deleteQuickTask({ companyId, workspaceId, userId, role, id: req.params.id });
    if (!qt) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Quick task not found' } });
    return res.status(200).json({ success: true, data: { ok: true } });
  } catch (e) {
    return next(e);
  }
}

export async function addComment(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const qt = await QuickTaskService.addQuickTaskComment({
      companyId,
      workspaceId,
      userId,
      role,
      taskId: req.params.id,
      content: req.body.content,
    });

    if (!qt) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Quick task not found' } });
    return res.status(200).json({ success: true, data: qt });
  } catch (e) {
    return next(e);
  }
}

export async function review(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const qt = await QuickTaskService.reviewQuickTask({
      companyId,
      workspaceId,
      userId,
      role,
      id: req.params.id,
      action: req.body.action,
      rating: req.body.rating,
      reviewRemark: req.body.reviewRemark,
    });
    if (!qt) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Quick task not found' } });
    return res.status(200).json({ success: true, data: qt });
  } catch (e) {
    return next(e);
  }
}

export async function uploadAttachments(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const requestBaseUrl = `${req.protocol}://${req.get('host')}`;

    // #region agent log
    fetch('http://127.0.0.1:7462/ingest/1ea124be-0e11-4062-90a0-e3d9902964d6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e243b9'},body:JSON.stringify({sessionId:'e243b9',runId:'pre-fix',hypothesisId:'H1',location:'server/src/controllers/quickTasks.controller.js:uploadAttachments',message:'QuickTask attachments upload called',data:{companyId:String(companyId),workspaceId:String(workspaceId),userId:String(userId),taskId:req.params.id,filesCount:Array.isArray(req.files)?req.files.length:0},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const qt = await QuickTaskService.addQuickTaskAttachments({
      companyId,
      workspaceId,
      userId,
      role,
      taskId: req.params.id,
      files: req.files || [],
      requestBaseUrl,
    });
    if (!qt) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Quick task not found' } });
    return res.status(200).json({ success: true, data: qt });
  } catch (e) {
    // #region agent log
    fetch('http://127.0.0.1:7462/ingest/1ea124be-0e11-4062-90a0-e3d9902964d6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e243b9'},body:JSON.stringify({sessionId:'e243b9',runId:'pre-fix',hypothesisId:'H1',location:'server/src/controllers/quickTasks.controller.js:uploadAttachments',message:'QuickTask attachments upload failed',data:{errorCode:e?.code||null,message:e?.message||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return next(e);
  }
}


import * as ProjectService from '../services/project.service.js';
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
    const { status, department, q, page, limit } = req.query;
    const result = await ProjectService.listProjects({
      companyId,
      workspaceId,
      userId,
      role,
      status,
      department,
      q,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
    return res.status(200).json({ success: true, data: result.items, meta: { total: result.total, page: result.page, limit: result.limit } });
  } catch (e) {
    return next(e);
  }
}

export async function get(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const project = await ProjectService.getProject({ companyId, workspaceId, projectId: req.params.id, userId, role });
    if (!project) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    return res.status(200).json({ success: true, data: project });
  } catch (e) {
    return next(e);
  }
}

export async function create(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;

    // #region agent log
    fileAgentLog({ sessionId: 'e243b9', runId: 'pre-fix', hypothesisId: 'H3', location: 'server/src/controllers/projects.controller.js:create', message: 'Project create called', data: { companyId: String(companyId), workspaceId: String(workspaceId), userId: String(userId), name: req.body?.name, hasMembers: Array.isArray(req.body?.members), membersCount: Array.isArray(req.body?.members) ? req.body.members.length : undefined }, timestamp: Date.now() });
    // #endregion

    const project = await ProjectService.createProject({ companyId, workspaceId, userId, role, data: req.body });
    return res.status(201).json({ success: true, data: project });
  } catch (e) {
    // #region agent log
    fileAgentLog({ sessionId: 'e243b9', runId: 'pre-fix', hypothesisId: 'H3', location: 'server/src/controllers/projects.controller.js:create', message: 'Project create failed', data: { errorCode: e?.code || null, message: e?.message || null }, timestamp: Date.now() });
    // #endregion
    return next(e);
  }
}

export async function importBulk(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const result = await ProjectService.importProjectsBulk({
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
    const project = await ProjectService.updateProject({ companyId, workspaceId, userId, role, projectId: req.params.id, updates: req.body });
    if (!project) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    return res.status(200).json({ success: true, data: project });
  } catch (e) {
    return next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const project = await ProjectService.deleteProject({ companyId, workspaceId, userId, role, projectId: req.params.id });
    if (!project) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    return res.status(200).json({ success: true, data: { ok: true } });
  } catch (e) {
    return next(e);
  }
}


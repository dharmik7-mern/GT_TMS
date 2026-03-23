import * as WorkspaceService from '../services/workspace.service.js';

export async function list(req, res, next) {
  try {
    const { sub: userId, companyId } = req.auth;
    const items = await WorkspaceService.listWorkspacesForUser({ userId, companyId });
    return res.status(200).json({ success: true, data: items });
  } catch (e) {
    return next(e);
  }
}

export async function update(req, res, next) {
  try {
    const { companyId, sub: userId, role } = req.auth;
    const item = await WorkspaceService.updateWorkspace({
      companyId,
      workspaceId: req.params.id,
      userId,
      role,
      updates: req.body || {},
    });
    if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } });
    return res.status(200).json({ success: true, data: item });
  } catch (e) {
    return next(e);
  }
}

export async function exportData(req, res, next) {
  try {
    const { companyId, sub: userId, role } = req.auth;
    const item = await WorkspaceService.exportWorkspaceData({
      companyId,
      workspaceId: req.params.id,
      userId,
      role,
    });
    if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } });
    return res.status(200).json({ success: true, data: item });
  } catch (e) {
    return next(e);
  }
}


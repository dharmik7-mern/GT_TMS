import * as UserService from '../services/user.service.js';
import { uploadIncomingFile } from '../services/storage.service.js';

export async function me(req, res, next) {
  try {
    const { sub: userId, companyId } = req.auth;
    const user = await UserService.getMe({ companyId, userId });
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return res.status(200).json({ success: true, data: user });
  } catch (e) {
    return next(e);
  }
}

export async function list(req, res, next) {
  try {
    const { companyId, role } = req.auth;
    console.log('[UsersController.list]', { companyId, role });
    const users = await UserService.listUsers({ companyId, actorRole: role });
    return res.status(200).json({ success: true, data: users });
  } catch (e) {
    console.error('[UsersController.list] Error:', e);
    return next(e);
  }
}

export async function mePerformance(req, res, next) {
  try {
    const { sub: userId, companyId, workspaceId } = req.auth;
    const performance = await UserService.getUserPerformance({ companyId, workspaceId, targetUserId: userId });
    return res.status(200).json({ success: true, data: performance });
  } catch (e) {
    return next(e);
  }
}

export async function get(req, res, next) {
  try {
    const { companyId, role } = req.auth;
    console.log('[UsersController.get]', { companyId, role, targetId: req.params.id });
    const user = await UserService.getUser({ companyId, id: req.params.id });
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return res.status(200).json({ success: true, data: user });
  } catch (e) {
    console.error('[UsersController.get] Error:', e);
    return next(e);
  }
}

export async function performance(req, res, next) {
  try {
    const { companyId, workspaceId, role } = req.auth;
    console.log('[UsersController.performance]', { companyId, workspaceId, role, targetId: req.params.id });
    const performance = await UserService.getUserPerformance({ companyId, workspaceId, targetUserId: req.params.id });
    if (!performance) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return res.status(200).json({ success: true, data: performance });
  } catch (e) {
    console.error('[UsersController.performance] Error:', e);
    return next(e);
  }
}

export async function create(req, res, next) {
  try {
    const { companyId, workspaceId, role } = req.auth;
    const user = await UserService.createUser({
      companyId,
      workspaceId,
      actorRole: role,
      input: req.body,
    });
    return res.status(201).json({ success: true, data: user });
  } catch (e) {
    return next(e);
  }
}

export async function importBulk(req, res, next) {
  try {
    const { companyId, workspaceId, role } = req.auth;
    const result = await UserService.importUsersBulk({
      companyId,
      workspaceId,
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
    const { companyId, workspaceId, role, sub: userId } = req.auth;
    console.log('[UsersController.update] Handing off to service:', {
      actorId: userId,
      actorRole: role,
      targetId: req.params.id,
      updates: JSON.stringify(req.body)
    });
    const user = await UserService.updateUser({
      companyId,
      workspaceId,
      actorRole: role,
      userId,
      targetUserId: req.params.id,
      updates: req.body,
    });
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return res.status(200).json({ success: true, data: user });
  } catch (e) {
    return next(e);
  }
}

export async function setPassword(req, res, next) {
  try {
    const { companyId, role, sub: userId } = req.auth;
    const ok = await UserService.setUserPassword({
      companyId,
      actorRole: role,
      actorUserId: userId,
      targetUserId: req.params.id,
      newPassword: req.body.newPassword,
    });
    if (!ok) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return res.status(200).json({ success: true, data: { ok: true } });
  } catch (e) {
    return next(e);
  }
}

export async function pendingTasks(req, res, next) {
  try {
    const { companyId } = req.auth;
    const tasks = await UserService.getUserPendingTasks({ companyId, targetUserId: req.params.id });
    return res.status(200).json({ success: true, data: tasks });
  } catch (e) {
    return next(e);
  }
}

export async function reassignAndDeactivate(req, res, next) {
  try {
    const { companyId, role, sub: userId } = req.auth;
    const user = await UserService.reassignAndDisable({
      companyId,
      actorRole: role,
      userId,
      targetUserId: req.params.id,
      mappings: req.body.mappings || [],
    });
    return res.status(200).json({ success: true, data: user });
  } catch (e) {
    return next(e);
  }
}

export async function updateMe(req, res, next) {
  try {
    const { sub: userId, companyId } = req.auth;
    const user = await UserService.updateMe({ companyId, userId, updates: req.body || {} });
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return res.status(200).json({ success: true, data: user });
  } catch (e) {
    return next(e);
  }
}

export async function updateMyPreferences(req, res, next) {
  try {
    const { sub: userId, companyId } = req.auth;
    const user = await UserService.updateMyPreferences({ companyId, userId, preferences: req.body || {} });
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return res.status(200).json({ success: true, data: user });
  } catch (e) {
    return next(e);
  }
}

export async function updateMyPassword(req, res, next) {
  try {
    const { sub: userId, companyId } = req.auth;
    await UserService.updateMyPassword({
      companyId,
      userId,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    });
    return res.status(200).json({ success: true, data: { ok: true } });
  } catch (e) {
    return next(e);
  }
}

export async function updateProfilePhoto(req, res, next) {
  try {
    const { sub: userId, companyId } = req.auth;
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }
    const requestBaseUrl = `${req.protocol}://${req.get('host')}`;
    const uploaded = await uploadIncomingFile({
      file: req.file,
      requestBaseUrl,
      category: 'avatars',
      entityId: userId,
    });
    const avatarUrl = uploaded.url;
    const user = await UserService.updateProfilePhoto({ companyId, userId, avatarUrl });
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return res.status(200).json({ success: true, data: user });
  } catch (e) {
    return next(e);
  }
}


import * as UserService from '../services/user.service.js';

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
    const { companyId } = req.auth;
    const users = await UserService.listUsers({ companyId });
    return res.status(200).json({ success: true, data: users });
  } catch (e) {
    return next(e);
  }
}

export async function get(req, res, next) {
  try {
    const { companyId } = req.auth;
    const user = await UserService.getUser({ companyId, id: req.params.id });
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return res.status(200).json({ success: true, data: user });
  } catch (e) {
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

export async function update(req, res, next) {
  try {
    const { companyId, workspaceId, role, sub: userId } = req.auth;
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

export async function remove(req, res, next) {
  try {
    const { companyId, role, sub: userId } = req.auth;
    const user = await UserService.deleteUser({
      companyId,
      actorRole: role,
      userId,
      targetUserId: req.params.id,
    });
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return res.status(200).json({ success: true, data: { ok: true } });
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


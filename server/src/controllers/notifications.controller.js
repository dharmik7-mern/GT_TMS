import * as NotificationService from '../services/notification.service.js';

export async function list(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId } = req.auth;
    const { page, limit } = req.query;
    const result = await NotificationService.listNotifications({
      companyId,
      workspaceId,
      userId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
    return res.status(200).json({ success: true, data: result.items, meta: { total: result.total, page: result.page, limit: result.limit } });
  } catch (e) {
    return next(e);
  }
}

export async function markRead(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId } = req.auth;
    const n = await NotificationService.markRead({ companyId, workspaceId, userId, id: req.params.id });
    if (!n) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
    return res.status(200).json({ success: true, data: n });
  } catch (e) {
    return next(e);
  }
}

export async function markAllRead(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId } = req.auth;
    await NotificationService.markAllRead({ companyId, workspaceId, userId });
    return res.status(200).json({ success: true, data: { ok: true } });
  } catch (e) {
    return next(e);
  }
}

export async function listBroadcastHistory(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await NotificationService.listBroadcastHistory({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
    return res.status(200).json({ success: true, data: result.items, meta: { total: result.total, page: result.page, limit: result.limit } });
  } catch (e) {
    return next(e);
  }
}

export async function broadcast(req, res, next) {
  try {
    const { role, sub: userId } = req.auth;
    const item = await NotificationService.createBroadcast({
      actorRole: role,
      actorUserId: userId,
      input: req.body,
    });
    return res.status(201).json({ success: true, data: item });
  } catch (e) {
    return next(e);
  }
}


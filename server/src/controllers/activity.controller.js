import * as ActivityService from '../services/activity.service.js';

export async function list(req, res, next) {
  try {
    const { companyId, workspaceId } = req.auth;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 500) : 100;
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const type = typeof req.query.type === 'string' ? req.query.type : '';
    const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : '';
    const days = req.query.days ? Number(req.query.days) : undefined;

    const items = await ActivityService.listActivity({
      companyId,
      workspaceId,
      limit,
      q,
      type,
      entityType,
      days,
    });

    return res.status(200).json({ success: true, data: items });
  } catch (e) {
    return next(e);
  }
}


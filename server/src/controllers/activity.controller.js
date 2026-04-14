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


export async function getByProject(req, res, next) {
  try {
    const { companyId, workspaceId } = req.auth;
    const { projectId } = req.params;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 500) : 200;

    const items = await ActivityService.listProjectActivity({
      companyId,
      workspaceId,
      projectId,
      limit,
    });

    return res.status(200).json({ success: true, data: items });
  } catch (e) {
    return next(e);
  }
}

export async function getProjectTimeline(req, res, next) {
  try {
    const { companyId, workspaceId } = req.auth;
    const { projectId } = req.params;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 20;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : '';
    const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : '';
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : '';

    const data = await ActivityService.getProjectTimeline({
      companyId,
      workspaceId,
      projectId,
      limit,
      cursor,
      userId,
      status,
      q,
      startDate,
      endDate,
    });

    return res.status(200).json({ success: true, data });
  } catch (e) {
    return next(e);
  }
}

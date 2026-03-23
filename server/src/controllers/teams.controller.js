import * as TeamService from '../services/team.service.js';

export async function list(req, res, next) {
  try {
    const { companyId, workspaceId } = req.auth;
    const items = await TeamService.listTeams({ companyId, workspaceId });
    return res.status(200).json({ success: true, data: items });
  } catch (e) {
    return next(e);
  }
}

export async function create(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId } = req.auth;
    const team = await TeamService.createTeam({ companyId, workspaceId, userId, data: req.body });
    return res.status(201).json({ success: true, data: team });
  } catch (e) {
    return next(e);
  }
}


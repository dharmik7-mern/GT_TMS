import { getTenantModels } from '../config/tenantDb.js';

export async function listTeams({ companyId, workspaceId }) {
  const tenantId = companyId;
  const { Team } = getTenantModels();
  const items = await Team.find({ tenantId, workspaceId }).sort({ createdAt: -1 });
  return items;
}

export async function createTeam({ companyId, workspaceId, userId, data }) {
  const tenantId = companyId;
  const { Team, ActivityLog } = getTenantModels();
  const team = await Team.create({
    tenantId,
    workspaceId,
    name: data.name,
    description: data.description,
    leaderId: data.leaderId || userId,
    members: data.members || [userId],
    projectIds: data.projectIds || [],
    color: data.color,
  });

  await ActivityLog.create({
    tenantId,
    workspaceId,
    userId,
    type: 'team_created',
    description: `Created team "${team.name}"`,
    entityType: 'team',
    entityId: team._id,
    metadata: {},
  });

  return team;
}


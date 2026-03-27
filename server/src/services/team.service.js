import mongoose from 'mongoose';
import { getTenantModels } from '../config/tenantDb.js';

function uniqueIds(values = []) {
  return Array.from(
    new Set(
      values
        .filter((value) => mongoose.Types.ObjectId.isValid(value))
        .map((value) => String(value))
    )
  );
}

async function syncTeamProjects({ Team, Project, tenantId, workspaceId, teamId, projectIds }) {
  await Team.updateMany(
    { tenantId, workspaceId, _id: { $ne: teamId } },
    { $pull: { projectIds: { $in: projectIds } } }
  );

  await Project.updateMany(
    { tenantId, workspaceId, teamId, _id: { $nin: projectIds } },
    { $set: { teamId: null } }
  );

  if (projectIds.length) {
    await Project.updateMany(
      { tenantId, workspaceId, _id: { $in: projectIds } },
      { $set: { teamId } }
    );
  }
}

export async function listTeams({ companyId, workspaceId }) {
  const tenantId = companyId;
  const { Team } = await getTenantModels(companyId);
  const items = await Team.find({ tenantId, workspaceId }).sort({ createdAt: -1 });
  return items;
}

export async function createTeam({ companyId, workspaceId, userId, data }) {
  const tenantId = companyId;
  const { Team, Project, ActivityLog } = await getTenantModels(companyId);
  const leaderIds = Array.from(
    new Set(
      (Array.isArray(data.leaderIds) ? data.leaderIds : [data.leaderId || userId])
        .filter(Boolean)
        .map((value) => String(value))
    )
  );
  const projectIds = uniqueIds(Array.isArray(data.projectIds) ? data.projectIds : []);
  const members = Array.from(
    new Set([
      ...(Array.isArray(data.members) ? data.members : []),
      ...leaderIds,
      String(userId),
    ].filter(Boolean).map((value) => String(value)))
  );
  const team = await Team.create({
    tenantId,
    workspaceId,
    name: data.name,
    description: data.description,
    leaderId: leaderIds[0] || userId,
    leaderIds,
    members,
    projectIds,
    color: data.color,
  });

  await syncTeamProjects({ Team, Project, tenantId, workspaceId, teamId: team._id, projectIds });

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

export async function updateTeam({ companyId, workspaceId, userId, teamId, updates }) {
  const tenantId = companyId;
  const { Team, Project, ActivityLog } = await getTenantModels(companyId);
  const team = await Team.findOne({ _id: teamId, tenantId, workspaceId });
  if (!team) return null;

  const leaderIds = uniqueIds(
    Array.isArray(updates.leaderIds)
      ? updates.leaderIds
      : updates.leaderId
        ? [updates.leaderId]
        : team.leaderIds?.length
          ? team.leaderIds
          : [team.leaderId]
  );
  const projectIds = updates.projectIds !== undefined
    ? uniqueIds(Array.isArray(updates.projectIds) ? updates.projectIds : [])
    : uniqueIds(Array.isArray(team.projectIds) ? team.projectIds : []);
  const members = updates.members !== undefined
    ? Array.from(new Set([
        ...uniqueIds(Array.isArray(updates.members) ? updates.members : []),
        ...leaderIds,
      ]))
    : Array.from(new Set([
        ...uniqueIds(Array.isArray(team.members) ? team.members : []),
        ...leaderIds,
      ]));

  team.name = updates.name !== undefined ? updates.name : team.name;
  team.description = updates.description !== undefined ? updates.description : team.description;
  team.color = updates.color !== undefined ? updates.color : team.color;
  team.leaderId = leaderIds[0] || team.leaderId || userId;
  team.leaderIds = leaderIds;
  team.members = members;
  team.projectIds = projectIds;
  await team.save();

  await syncTeamProjects({ Team, Project, tenantId, workspaceId, teamId: team._id, projectIds });

  await ActivityLog.create({
    tenantId,
    workspaceId,
    userId,
    type: 'team_updated',
    description: `Updated team "${team.name}"`,
    entityType: 'team',
    entityId: team._id,
    metadata: {},
  });

  return team;
}

export async function deleteTeam({ companyId, workspaceId, userId, teamId }) {
  const tenantId = companyId;
  const { Team, Project, ActivityLog } = await getTenantModels(companyId);
  const team = await Team.findOne({ _id: teamId, tenantId, workspaceId });
  if (!team) return null;

  await Project.updateMany(
    { tenantId, workspaceId, teamId: team._id },
    { $set: { teamId: null } }
  );

  await Team.deleteOne({ _id: team._id, tenantId, workspaceId });

  await ActivityLog.create({
    tenantId,
    workspaceId,
    userId,
    type: 'team_deleted',
    description: `Deleted team "${team.name}"`,
    entityType: 'team',
    entityId: team._id,
    metadata: {},
  });

  return team;
}


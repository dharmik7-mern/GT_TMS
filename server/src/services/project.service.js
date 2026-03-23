import { getTenantModels } from '../config/tenantDb.js';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

const DEBUG_LOG_FILE = path.join(process.cwd(), 'debug-e243b9.log');
function fileAgentLog(payload) {
  try {
    fs.appendFileSync(DEBUG_LOG_FILE, JSON.stringify(payload) + '\n');
  } catch {
    // ignore logging errors
  }
}

export async function listProjects({ companyId, workspaceId, status, department, q, page = 1, limit = 50 }) {
  const tenantId = companyId;
  const { Project } = getTenantModels();
  const filter = { tenantId, workspaceId };
  if (status) filter.status = status;
  if (department) filter.department = department;
  if (q) filter.$text = { $search: q };

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Project.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Project.countDocuments(filter),
  ]);

  return { items, total, page, limit };
}

export async function getProject({ companyId, workspaceId, projectId }) {
  const tenantId = companyId;
  const { Project } = getTenantModels();
  const project = await Project.findOne({ _id: projectId, tenantId, workspaceId });
  return project;
}

export async function createProject({ companyId, workspaceId, userId, data }) {
  const tenantId = companyId;
  const { Project, ActivityLog } = getTenantModels();
  const incomingMembers = Array.isArray(data.members) ? data.members.filter(Boolean) : [];
  const validMembers = incomingMembers.filter((memberId) => mongoose.Types.ObjectId.isValid(memberId));
  const members = validMembers.length > 0 ? validMembers : [userId];
  const teamId = data.teamId && mongoose.Types.ObjectId.isValid(data.teamId) ? data.teamId : null;

  const project = await Project.create({
    tenantId,
    workspaceId,
    name: data.name,
    description: data.description,
    color: data.color,
    status: data.status || 'active',
    department: data.department || 'General',
    teamId,
    ownerId: userId,
    members,
    startDate: data.startDate ? new Date(data.startDate) : null,
    endDate: data.endDate ? new Date(data.endDate) : null,
    progress: 0,
    tasksCount: 0,
    completedTasksCount: 0,
  });

  // #region agent log
  fileAgentLog({ sessionId: 'e243b9', runId: 'pre-fix', hypothesisId: 'H3', location: 'server/src/services/project.service.js:createProject', message: 'Project created in DB', data: { tenantId: String(tenantId), workspaceId: String(workspaceId), ownerId: String(userId), projectId: String(project?._id), membersCount: Array.isArray(project?.members) ? project.members.length : undefined }, timestamp: Date.now() });
  // #endregion

  try {
    await ActivityLog.create({
      tenantId,
      workspaceId,
      userId,
      type: 'project_created',
      description: `Created project "${project.name}"`,
      entityType: 'project',
      entityId: project._id,
      metadata: { projectId: project._id },
    });
  } catch (error) {
    logger.error('project_activity_log_failed', {
      projectId: String(project._id),
      userId: String(userId),
      message: error?.message,
    });
  }

  return project;
}

export async function updateProject({ companyId, workspaceId, userId, projectId, updates }) {
  const tenantId = companyId;
  const { Project, ActivityLog } = getTenantModels();
  const project = await Project.findOneAndUpdate(
    { _id: projectId, tenantId, workspaceId },
    {
      $set: {
        ...updates,
        ...(updates.startDate ? { startDate: new Date(updates.startDate) } : {}),
        ...(updates.endDate ? { endDate: new Date(updates.endDate) } : {}),
      },
    },
    { new: true }
  );
  if (!project) return null;

  await ActivityLog.create({
    tenantId,
    workspaceId,
    userId,
    type: 'project_updated',
    description: `Updated project "${project.name}"`,
    entityType: 'project',
    entityId: project._id,
    metadata: { projectId: project._id },
  });

  return project;
}

export async function deleteProject({ companyId, workspaceId, userId, projectId }) {
  const tenantId = companyId;
  const { Project, ActivityLog } = getTenantModels();
  const project = await Project.findOneAndDelete({ _id: projectId, tenantId, workspaceId });
  if (!project) return null;

  await ActivityLog.create({
    tenantId,
    workspaceId,
    userId,
    type: 'project_deleted',
    description: `Deleted project "${project.name}"`,
    entityType: 'project',
    entityId: project._id,
    metadata: { projectId: project._id },
  });

  return project;
}


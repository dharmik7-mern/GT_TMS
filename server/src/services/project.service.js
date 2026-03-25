import { getTenantModels } from '../config/tenantDb.js';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import AdminConversation from '../models/admin/AdminConversation.model.js';

const DEBUG_LOG_FILE = path.join(process.cwd(), 'debug-e243b9.log');
function fileAgentLog(payload) {
  try {
    fs.appendFileSync(DEBUG_LOG_FILE, JSON.stringify(payload) + '\n');
  } catch {
    // ignore logging errors
  }
}

function normalizeSdlcPlan(input) {
  const phases = Array.isArray(input) ? input : [];
  return phases
    .map((phase) => ({
      name: String(phase?.name ?? '').trim(),
      durationDays: Math.max(0, Number(phase?.durationDays ?? 0) || 0),
      notes: String(phase?.notes ?? '').trim(),
    }))
    .filter((phase) => phase.name);
}

export async function listProjects({ companyId, workspaceId, status, department, q, page = 1, limit = 50 }) {
  const tenantId = companyId;
  const { Project } = await getTenantModels(companyId);
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
  const { Project } = await getTenantModels(companyId);
  const project = await Project.findOne({ _id: projectId, tenantId, workspaceId });
  return project;
}

export async function createProject({ companyId, workspaceId, userId, data }) {
  const tenantId = companyId;
  const { Project, ActivityLog } = await getTenantModels(companyId);
  const incomingMembers = Array.isArray(data.members) ? data.members.filter(Boolean) : [];
  const validMembers = incomingMembers.filter((memberId) => mongoose.Types.ObjectId.isValid(memberId));
  const members = Array.from(new Set([
    ...validMembers.map(String),
    String(userId),
  ]));
  const incomingReportingPersons = Array.isArray(data.reportingPersonIds) ? data.reportingPersonIds.filter(Boolean) : [];
  const reportingPersonIds = Array.from(new Set(
    incomingReportingPersons
      .filter((personId) => mongoose.Types.ObjectId.isValid(personId))
      .map(String)
  ));
  const sdlcPlan = normalizeSdlcPlan(data.sdlcPlan);
  const totalPlannedDurationDays = sdlcPlan.reduce((sum, phase) => sum + phase.durationDays, 0);
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
    reportingPersonIds,
    startDate: data.startDate ? new Date(data.startDate) : null,
    endDate: data.endDate ? new Date(data.endDate) : null,
    budget: Number.isFinite(data.budget) ? Number(data.budget) : null,
    budgetCurrency: String(data.budgetCurrency || 'INR').trim().slice(0, 8) || 'INR',
    sdlcPlan,
    totalPlannedDurationDays,
    progress: 0,
    tasksCount: 0,
    completedTasksCount: 0,
  });

  try {
    const conversation = await AdminConversation.create({
      participants: members,
      isGroup: true,
      groupName: `${project.name} (Project)`,
      projectId: project._id,
      groupType: 'project',
      department: project.department || 'General',
    });

    project.chatId = conversation._id;
    await project.save();
  } catch (error) {
    logger.error('project_chat_create_failed', {
      projectId: String(project._id),
      userId: String(userId),
      message: error?.message,
    });
  }

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
  const { Project, ActivityLog } = await getTenantModels(companyId);
  const normalizedUpdates = { ...updates };

  if (Array.isArray(updates.members)) {
    normalizedUpdates.members = Array.from(new Set(
      updates.members
        .filter((memberId) => mongoose.Types.ObjectId.isValid(memberId))
        .map(String)
    ));
  }

  if (Array.isArray(updates.reportingPersonIds)) {
    normalizedUpdates.reportingPersonIds = Array.from(new Set(
      updates.reportingPersonIds
        .filter((personId) => mongoose.Types.ObjectId.isValid(personId))
        .map(String)
    ));
  }

  if (updates.budget !== undefined) {
    normalizedUpdates.budget = Number.isFinite(updates.budget) ? Number(updates.budget) : null;
  }

  if (updates.budgetCurrency !== undefined) {
    normalizedUpdates.budgetCurrency = String(updates.budgetCurrency || 'INR').trim().slice(0, 8) || 'INR';
  }

  if (updates.sdlcPlan !== undefined) {
    normalizedUpdates.sdlcPlan = normalizeSdlcPlan(updates.sdlcPlan);
    normalizedUpdates.totalPlannedDurationDays = normalizedUpdates.sdlcPlan.reduce((sum, phase) => sum + phase.durationDays, 0);
  }

  const project = await Project.findOneAndUpdate(
    { _id: projectId, tenantId, workspaceId },
    {
      $set: {
        ...normalizedUpdates,
        ...(updates.startDate ? { startDate: new Date(updates.startDate) } : {}),
        ...(updates.endDate ? { endDate: new Date(updates.endDate) } : {}),
      },
    },
    { new: true }
  );
  if (!project) return null;

  try {
    const chatPayload = {};
    if (normalizedUpdates.name) chatPayload.groupName = `${normalizedUpdates.name} (Project)`;
    if (normalizedUpdates.department) chatPayload.department = normalizedUpdates.department;
    if (Array.isArray(normalizedUpdates.members)) chatPayload.participants = normalizedUpdates.members;

    if (project.chatId) {
      if (Object.keys(chatPayload).length > 0) {
        await AdminConversation.findByIdAndUpdate(project.chatId, { $set: chatPayload });
      }
    } else {
      const conversation = await AdminConversation.create({
        participants: project.members,
        isGroup: true,
        groupName: `${project.name} (Project)`,
        projectId: project._id,
        groupType: 'project',
        department: project.department || 'General',
      });

      project.chatId = conversation._id;
      await project.save();
    }
  } catch (error) {
    logger.error('project_chat_sync_failed', {
      projectId: String(project._id),
      userId: String(userId),
      message: error?.message,
    });
  }

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
  const { Project, ActivityLog } = await getTenantModels(companyId);
  const project = await Project.findOneAndDelete({ _id: projectId, tenantId, workspaceId });
  if (!project) return null;

  if (project.chatId) {
    try {
      await AdminConversation.findByIdAndDelete(project.chatId);
    } catch (error) {
      logger.error('project_chat_delete_failed', {
        projectId: String(project._id),
        userId: String(userId),
        message: error?.message,
      });
    }
  }

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


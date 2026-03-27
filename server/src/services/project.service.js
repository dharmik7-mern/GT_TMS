import { getTenantModels } from '../config/tenantDb.js';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { initializeProjectPlanning } from './timeline.service.js';
import { createTask } from './task.service.js';

const DEBUG_LOG_FILE = path.join(process.cwd(), 'debug-e243b9.log');
const PROJECT_IMPORT_FALLBACK_COLOR = '#3366FF';
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

function normalizeUserIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUserName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

async function buildUserDirectory(companyId) {
  const { User } = await getTenantModels(companyId);
  const users = await User.find({ tenantId: companyId }).select('name email employeeId').lean();
  const byEmail = new Map();
  const byEmployeeId = new Map();
  const byName = new Map();

  for (const user of users) {
    if (user?.email) byEmail.set(normalizeUserIdentifier(user.email), String(user._id));
    if (user?.employeeId) byEmployeeId.set(normalizeUserIdentifier(user.employeeId), String(user._id));
    const normalizedName = normalizeUserName(user?.name);
    if (!normalizedName) continue;
    const items = byName.get(normalizedName) || [];
    items.push({ id: String(user._id), name: user.name });
    byName.set(normalizedName, items);
  }

  return { byEmail, byEmployeeId, byName };
}

function resolveIdentifierFromDirectory(identifier, directory, fieldLabel) {
  const normalized = normalizeUserIdentifier(identifier);
  if (!normalized) return null;
  if (directory.byEmail.has(normalized)) return directory.byEmail.get(normalized);
  if (directory.byEmployeeId.has(normalized)) return directory.byEmployeeId.get(normalized);

  const normalizedName = normalizeUserName(identifier);
  const nameMatches = directory.byName.get(normalizedName) || [];
  if (nameMatches.length === 1) return nameMatches[0].id;
  if (nameMatches.length > 1) {
    const err = new Error(`${fieldLabel} is ambiguous for "${identifier}". Multiple users share that name.`);
    err.statusCode = 400;
    err.code = 'USER_LOOKUP_AMBIGUOUS';
    throw err;
  }

  const err = new Error(`${fieldLabel} not found for "${identifier}". Match by full name, email, or employee ID.`);
  err.statusCode = 400;
  err.code = 'USER_LOOKUP_NOT_FOUND';
  throw err;
}

async function resolveUserIdsFromIdentifiers({ companyId, identifiers, fieldLabel }) {
  const normalizedIdentifiers = Array.from(
    new Set(
      (Array.isArray(identifiers) ? identifiers : [])
        .map((identifier) => String(identifier || '').trim())
        .filter(Boolean)
    )
  );
  if (!normalizedIdentifiers.length) return [];

  const directory = await buildUserDirectory(companyId);
  return normalizedIdentifiers
    .map((identifier) => resolveIdentifierFromDirectory(identifier, directory, fieldLabel))
    .filter(Boolean);
}

function parseSdlcPlanImport(value) {
  if (!String(value || '').trim()) return [];
  return String(value)
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [namePart, durationPart] = part.split(':');
      return {
        name: String(namePart || '').trim(),
        durationDays: Math.max(0, Number(String(durationPart || '').trim()) || 0),
        notes: '',
      };
    })
    .filter((phase) => phase.name);
}

function parseTaskSubtasks(value) {
  return String(value || '')
    .split(/[;\n|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((title, index) => ({ title, isCompleted: false, order: index }));
}

function isProjectAdminRole(role) {
  return ['super_admin', 'admin', 'manager'].includes(role);
}

function buildProjectAccessFilter({ role, userId }) {
  if (isProjectAdminRole(role)) return {};
  return {
    $or: [
      { ownerId: userId },
      { members: userId },
      { reportingPersonIds: userId },
    ],
  };
}

export async function listProjects({ companyId, workspaceId, userId, role, status, department, q, page = 1, limit = 50 }) {
  const tenantId = companyId;
  const { Project } = await getTenantModels(companyId);
  const filter = { tenantId, workspaceId, ...buildProjectAccessFilter({ role, userId }) };
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

export async function getProject({ companyId, workspaceId, projectId, userId, role }) {
  const tenantId = companyId;
  const { Project } = await getTenantModels(companyId);
  const project = await Project.findOne({ _id: projectId, tenantId, workspaceId, ...buildProjectAccessFilter({ role, userId }) });
  return project;
}

export async function createProject({ companyId, workspaceId, userId, role, data }) {
  if (role === 'team_member') {
    const err = new Error('Team members are not allowed to create projects');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

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
    const { AdminConversation } = await getTenantModels(companyId);
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

  try {
    await initializeProjectPlanning({
      companyId,
      workspaceId,
      project,
      userId,
    });
  } catch (error) {
    logger.error('project_planning_bootstrap_failed', {
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

export async function updateProject({ companyId, workspaceId, userId, role, projectId, updates }) {
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
    { _id: projectId, tenantId, workspaceId, ...buildProjectAccessFilter({ role, userId }) },
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
    const { AdminConversation } = await getTenantModels(companyId);
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

export async function deleteProject({ companyId, workspaceId, userId, role, projectId }) {
  const tenantId = companyId;
  const { Project, ActivityLog } = await getTenantModels(companyId);
  const project = await Project.findOneAndDelete({ _id: projectId, tenantId, workspaceId, ...buildProjectAccessFilter({ role, userId }) });
  if (!project) return null;

  if (project.chatId) {
    try {
      const { AdminConversation } = await getTenantModels(companyId);
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

export async function importProjectsBulk({ companyId, workspaceId, userId, actorRole, rows }) {
  if (!['super_admin', 'admin', 'manager', 'team_leader'].includes(actorRole)) {
    const err = new Error('Only admins, managers, or team leaders can import projects');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const normalizedRows = Array.isArray(rows) ? rows : [];
  if (!normalizedRows.length) {
    const err = new Error('No projects provided for import');
    err.statusCode = 400;
    err.code = 'IMPORT_EMPTY';
    throw err;
  }

  const { Phase } = await getTenantModels(companyId);
  const groups = new Map();
  for (let index = 0; index < normalizedRows.length; index += 1) {
    const row = normalizedRows[index] || {};
    const projectKey = String(row.projectKey || '').trim();
    const items = groups.get(projectKey) || [];
    items.push({ ...row, rowNumber: Number(row.rowNumber) > 0 ? Number(row.rowNumber) : index + 2 });
    groups.set(projectKey, items);
  }

  const createdProjects = [];
  const failures = [];
  let createdTaskCount = 0;

  for (const [projectKey, projectRows] of groups.entries()) {
    const seedRow = projectRows[0];
    let project = null;
    try {
      const memberIdentifiers = [
        ...projectRows.flatMap((row) => String(row.memberEmails ?? '').split(/[;,]/).map((item) => item.trim()).filter(Boolean)),
        ...projectRows.flatMap((row) => String(row.memberNames ?? '').split(/[;,]/).map((item) => item.trim()).filter(Boolean)),
        ...projectRows.flatMap((row) => String(row.taskAssigneeEmails ?? '').split(/[;,]/).map((item) => item.trim()).filter(Boolean)),
        ...projectRows.flatMap((row) => String(row.taskAssigneeNames ?? '').split(/[;,]/).map((item) => item.trim()).filter(Boolean)),
      ];
      const reportingIdentifiers = [
        ...projectRows.flatMap((row) => String(row.reportingPersonEmails ?? '').split(/[;,]/).map((item) => item.trim()).filter(Boolean)),
        ...projectRows.flatMap((row) => String(row.reportingPersonNames ?? '').split(/[;,]/).map((item) => item.trim()).filter(Boolean)),
      ];

      const memberIds = await resolveUserIdsFromIdentifiers({
        companyId,
        identifiers: memberIdentifiers,
        fieldLabel: 'Project members',
      });
      const reportingPersonIds = await resolveUserIdsFromIdentifiers({
        companyId,
        identifiers: reportingIdentifiers,
        fieldLabel: 'Reporting persons',
      });

      project = await createProject({
        companyId,
        workspaceId,
        userId,
        role: actorRole,
        data: {
          name: String(seedRow.projectName ?? '').trim(),
          description: String(seedRow.projectDescription ?? '').trim(),
          color: String(seedRow.projectColor || '').trim() || PROJECT_IMPORT_FALLBACK_COLOR,
          status: seedRow.projectStatus || 'active',
          department: String(seedRow.projectDepartment || '').trim() || 'General',
          members: memberIds,
          reportingPersonIds,
          startDate: seedRow.startDate ? String(seedRow.startDate).trim() : undefined,
          endDate: seedRow.endDate ? String(seedRow.endDate).trim() : undefined,
          budget: typeof seedRow.budget === 'number' ? seedRow.budget : undefined,
          budgetCurrency: String(seedRow.budgetCurrency || '').trim() || 'INR',
          sdlcPlan: parseSdlcPlanImport(seedRow.sdlcPlan),
        },
      });
      createdProjects.push(project);
    } catch (error) {
      for (const row of projectRows) {
        failures.push({
          rowNumber: row.rowNumber,
          projectKey,
          projectName: String(row.projectName ?? '').trim(),
          taskTitle: String(row.taskTitle ?? '').trim(),
          message: error?.message || 'Failed to import project',
          code: error?.code || 'IMPORT_FAILED',
        });
      }
      continue;
    }

    const phases = await Phase.find({ tenantId: companyId, workspaceId, projectId: project.id }).lean();
    const phaseMap = new Map(
      phases.map((phase) => [String(phase.name || '').trim().toLowerCase(), String(phase._id)])
    );

    for (const row of projectRows) {
      const taskTitle = String(row.taskTitle ?? '').trim();
      if (!taskTitle) continue;
      try {
        const assigneeIdentifiers = [
          ...String(row.taskAssigneeEmails ?? '').split(/[;,]/).map((item) => item.trim()).filter(Boolean),
          ...String(row.taskAssigneeNames ?? '').split(/[;,]/).map((item) => item.trim()).filter(Boolean),
        ];
        const assigneeIds = await resolveUserIdsFromIdentifiers({
          companyId,
          identifiers: assigneeIdentifiers,
          fieldLabel: 'Task assignees',
        });
        const phaseId = phaseMap.get(String(row.taskPhase || '').trim().toLowerCase());

        await createTask({
          companyId,
          workspaceId,
          userId,
          role: actorRole,
          data: {
            projectId: project.id,
            title: taskTitle,
            description: String(row.taskDescription ?? '').trim(),
            status: row.taskStatus || 'todo',
            priority: row.taskPriority || 'medium',
            assigneeIds,
            startDate: row.taskStartDate ? String(row.taskStartDate).trim() : (project.startDate || undefined),
            durationDays: Number(row.taskDurationDays) > 0 ? Number(row.taskDurationDays) : 1,
            phaseId,
            estimatedHours: typeof row.taskEstimatedHours === 'number' ? row.taskEstimatedHours : undefined,
            subtasks: parseTaskSubtasks(row.taskSubtasks),
          },
        });
        createdTaskCount += 1;
      } catch (error) {
        failures.push({
          rowNumber: row.rowNumber,
          projectKey,
          projectName: String(row.projectName ?? '').trim(),
          taskTitle,
          message: error?.message || 'Failed to import task',
          code: error?.code || 'TASK_IMPORT_FAILED',
        });
      }
    }
  }

  return {
    totalRows: normalizedRows.length,
    createdCount: createdProjects.length,
    createdTaskCount,
    failedCount: failures.length,
    createdProjects,
    failures,
  };
}


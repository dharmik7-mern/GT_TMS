import mongoose from 'mongoose';
import AuthLookup from '../models/AuthLookup.js';
import Company from '../models/Company.js';
import { getTenantModels } from '../config/tenantDb.js';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function toPlain(doc) {
  if (!doc) return null;
  return typeof doc.toJSON === 'function' ? doc.toJSON() : doc;
}

function dateValue(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function mapProject(project, workspaceRole, taskCount) {
  const data = toPlain(project);
  return {
    id: String(data.id || data._id),
    name: data.name,
    status: data.status,
    color: data.color,
    department: data.department || null,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    progress: typeof data.progress === 'number' ? data.progress : 0,
    tasksCount: typeof taskCount === 'number' ? taskCount : 0,
    workspaceRole,
  };
}

function mapTask(task, projectMap) {
  const data = toPlain(task);
  const projectId = String(data.projectId || '');
  const project = projectMap.get(projectId) || null;
  return {
    id: String(data.id || data._id),
    title: data.title,
    status: data.status,
    priority: data.priority,
    type: data.type || data.timelineType || 'task',
    startDate: data.startDate || null,
    dueDate: data.dueDate || null,
    durationMinutes: typeof data.duration === 'number' ? data.duration : null,
    estimatedHours: typeof data.estimatedHours === 'number' ? data.estimatedHours : null,
    project: project
      ? {
          id: project.id,
          name: project.name,
          status: project.status,
        }
      : null,
  };
}

function mapQuickTask(task) {
  const data = toPlain(task);
  return {
    id: String(data.id || data._id),
    title: data.title,
    status: data.status,
    priority: data.priority,
    dueDate: data.dueDate || null,
    isPrivate: Boolean(data.isPrivate),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

export async function getHrmsDashboardByEmail({ email, includeCompleted = false, limit = 50, companyId: providedCompanyId }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    const err = new Error('Email is required.');
    err.statusCode = 400;
    err.code = 'EMAIL_REQUIRED';
    throw err;
  }

  console.log('[TMS_INTEGRATION] Fetching dashboard for:', normalizedEmail, 'Provided CompanyId:', providedCompanyId);
  
  let authLookup = await AuthLookup.findOne({ email: normalizedEmail }).select('tenantId').lean();
  let companyId = providedCompanyId || authLookup?.tenantId;

  if (!companyId) {
    console.log('[TMS_INTEGRATION] Missing companyId. Searching User collection across all companies for:', normalizedEmail);
    // Last ditch effort: Search the User model in the central db if it exists, 
    // or look through companies.
    const allCompanies = await Company.find().select('_id').lean();
    for (const c of allCompanies) {
      const { User: TempUser } = await getTenantModels(c._id);
      const exists = await TempUser.exists({ email: normalizedEmail });
      if (exists) {
        companyId = c._id;
        console.log('[TMS_INTEGRATION] Found user in company:', companyId);
        break;
      }
    }
  }

  if (!companyId) {
    console.error('[TMS_INTEGRATION] ALL Resolution methods failed for:', normalizedEmail);
    const err = new Error('No company mapping found. Please contact support.');
    err.statusCode = 404;
    err.code = 'HRMS_USER_NOT_FOUND';
    throw err;
  }

  const company = await Company.findById(companyId).select('name email organizationId status color').lean();
  if (!company) {
    console.error('[TMS_INTEGRATION] Company FAIL: Company not found in TMS for id:', companyId);
    const err = new Error('Company not found in TMS.');
    err.statusCode = 404;
    err.code = 'COMPANY_NOT_FOUND';
    throw err;
  }

  const { User, Membership, Workspace, Task, QuickTask, Project } = await getTenantModels(companyId);

  let user = await User.findOne({ tenantId: companyId, email: normalizedEmail });
  
  if (!user) {
    console.log('[TMS_INTEGRATION] User not found in TMS. Attempting auto-provision from HRMS...');
    
    // Connect to HRMS database directly to find the employee
    const hrmsConn = mongoose.connection.useDb(`company_${companyId}`);
    const hrmsEmployeeColl = hrmsConn.db.collection('employees');
    // Case-insensitive email search
    const hrmsEmp = await hrmsEmployeeColl.findOne({ 
      email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } 
    });

    if (hrmsEmp) {
      console.log('[TMS_INTEGRATION] Found employee in HRMS:', hrmsEmp.firstName, hrmsEmp.lastName);
      
      const hrmsRole = String(hrmsEmp.role || '').toLowerCase();
      let tmsRole = 'team_member';
      if (['admin', 'hr', 'hr_admin', 'company_admin', 'super_admin'].includes(hrmsRole)) {
        tmsRole = 'admin';
      }

      // Use upsert to avoid 11000 errors if data is partially synced
      user = await User.findOneAndUpdate(
        { tenantId: companyId, email: normalizedEmail },
        {
          $setOnInsert: {
            name: hrmsEmp.name || `${hrmsEmp.firstName || ''} ${hrmsEmp.lastName || ''}`.trim() || normalizedEmail,
            isActive: true,
            role: tmsRole,
            employeeId: hrmsEmp.employeeId || `HRMS-${Math.random().toString(36).slice(-6).toUpperCase()}`,
            passwordHash: 'provisioned_by_hrms_integration'
          }
        },
        { upsert: true, new: true }
      );

      // Ensure AuthLookup exists
      await AuthLookup.findOneAndUpdate(
        { email: normalizedEmail },
        { $setOnInsert: { tenantId: companyId } },
        { upsert: true }
      );

      // Add to the first available workspace in TMS if no memberships exist
      const existingMembership = await Membership.exists({ userId: user._id });
      if (!existingMembership) {
        const firstWorkspace = await Workspace.findOne({ tenantId: companyId }).sort({ createdAt: 1 });
        if (firstWorkspace) {
          await Membership.create({
            tenantId: companyId,
            workspaceId: firstWorkspace._id,
            userId: user._id,
            role: tmsRole,
            status: 'active'
          });
          console.log('[TMS_INTEGRATION] Auto-provisioned user added to first workspace:', firstWorkspace.name);
        }
      }
    } else {
      console.error('[TMS_INTEGRATION] User Provisioning FAIL: Employee not found in HRMS Database:', `company_${companyId}`);
      const err = new Error('User record not found in Project or HRMS systems.');
      err.statusCode = 404;
      err.code = 'HRMS_ACTIVE_USER_NOT_FOUND';
      throw err;
    }
  }

  // Ensure user is active for the rest of the flow
  if (!user.isActive) {
     user.isActive = true;
     await user.save();
  }

  console.log('[TMS_INTEGRATION] Dashboard query starting for user:', user.email, 'userId:', user._id);

  const memberships = await Membership.find({
    tenantId: companyId,
    userId: user._id,
    status: 'active',
  }).sort({ createdAt: 1 });

  const workspaceIds = memberships.map((membership) => membership.workspaceId);
  const workspaces = await Workspace.find({
    tenantId: companyId,
    _id: { $in: workspaceIds },
  });

  const workspaceMap = new Map(workspaces.map((workspace) => [String(workspace._id), toPlain(workspace)]));
  const membershipRoleByWorkspaceId = new Map(
    memberships.map((membership) => [String(membership.workspaceId), membership.role])
  );

  const taskFilter = {
    tenantId: companyId,
    workspaceId: { $in: workspaceIds },
    assigneeIds: user._id,
    $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }],
  };
  const pendingTaskFilter = { ...taskFilter, status: { $ne: 'done' } };
  const visibleTaskFilter = includeCompleted ? taskFilter : pendingTaskFilter;

  const quickTaskFilter = {
    tenantId: companyId,
    workspaceId: { $in: workspaceIds },
    assigneeIds: user._id,
  };
  const pendingQuickTaskFilter = { ...quickTaskFilter, status: { $ne: 'done' } };
  const visibleQuickTaskFilter = includeCompleted ? quickTaskFilter : pendingQuickTaskFilter;

  const isTmsAdmin = ['super_admin', 'admin', 'company_admin', 'manager'].includes(user.role);

  const projectFilter = {
    tenantId: companyId,
    workspaceId: { $in: workspaceIds },
  };

  // Temporarily show all projects in the workspace to ensure visibility
  // In production, we might want to restrict this based on 'seeOtherProjects' permission
  if (!isTmsAdmin) {
    // If we want to be strict, we'd use membership. 
    // But for now, let's allow visibility if they are in the workspace.
    // projectFilter.$or = [{ ownerId: user._id }, { members: user._id }, { reportingPersonIds: user._id }];
  }

  if (!includeCompleted) {
    projectFilter.status = { $nin: ['completed', 'archived'] };
  }

  const [
    tasks,
    quickTasks,
    baseProjects,
    totalTasksCount,
    totalQuickTasksCount,
    pendingProjectTasksCount,
    pendingQuickTasksCount,
  ] = await Promise.all([
    Task.find(visibleTaskFilter).sort({ dueDate: 1, updatedAt: -1 }).limit(limit),
    QuickTask.find(visibleQuickTaskFilter).sort({ dueDate: 1, updatedAt: -1 }).limit(limit),
    Project.find(projectFilter).sort({ updatedAt: -1 }),
    Task.countDocuments(taskFilter),
    QuickTask.countDocuments(quickTaskFilter),
    Task.countDocuments(pendingTaskFilter),
    QuickTask.countDocuments(pendingQuickTaskFilter),
  ]);

  const taskProjectIds = Array.from(
    new Set(tasks.map((task) => String(task.projectId || '')).filter(Boolean))
  );
  const memberProjectIds = Array.from(
    new Set(baseProjects.map((project) => String(project._id)))
  );
  const allProjectIds = Array.from(new Set([...taskProjectIds, ...memberProjectIds]));

  const projects = allProjectIds.length
    ? await Project.find({
        tenantId: companyId,
        _id: { $in: allProjectIds },
      }).sort({ updatedAt: -1 })
    : [];

  const projectMap = new Map(projects.map((project) => [String(project._id), toPlain(project)]));
  const taskCountByProjectId = new Map();
  for (const task of tasks) {
    const projectId = String(task.projectId || '');
    if (!projectId) continue;
    taskCountByProjectId.set(projectId, (taskCountByProjectId.get(projectId) || 0) + 1);
  }

  const workspacePayload = memberships.map((membership) => {
    const workspaceId = String(membership.workspaceId);
    const workspace = workspaceMap.get(workspaceId);
    const workspaceTasks = tasks
      .filter((task) => String(task.workspaceId) === workspaceId)
      .sort((a, b) => dateValue(a.dueDate) - dateValue(b.dueDate))
      .map((task) => mapTask(task, projectMap));
    const workspaceQuickTasks = quickTasks
      .filter((task) => String(task.workspaceId) === workspaceId)
      .sort((a, b) => dateValue(a.dueDate) - dateValue(b.dueDate))
      .map(mapQuickTask);
    const workspaceProjects = projects
      .filter((project) => String(project.workspaceId) === workspaceId)
      .map((project) => mapProject(project, membershipRoleByWorkspaceId.get(workspaceId) || membership.role, taskCountByProjectId.get(String(project._id)) || 0));

    return {
      id: workspaceId,
      name: workspace?.name || 'Workspace',
      slug: workspace?.slug || null,
      role: membership.role,
      tasks: workspaceTasks,
      quickTasks: workspaceQuickTasks,
      projects: workspaceProjects,
      summary: {
        tasksCount: workspaceTasks.length,
        quickTasksCount: workspaceQuickTasks.length,
        projectsCount: workspaceProjects.length,
      },
    };
  });

  return {
    company: company
      ? {
          id: String(company._id),
          name: company.name,
          organizationId: company.organizationId,
          status: company.status,
          color: company.color || null,
        }
      : null,
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      jobTitle: user.jobTitle || null,
      department: user.department || null,
      avatar: user.avatar || null,
      employeeId: user.employeeId || null,
    },
    summary: {
      workspacesCount: workspacePayload.length,
      totalTasks: totalTasksCount,
      totalQuickTasks: totalQuickTasksCount,
      pendingTasks: pendingProjectTasksCount + pendingQuickTasksCount,
      pendingProjectTasks: pendingProjectTasksCount,
      pendingQuickTasks: pendingQuickTasksCount,
      assignedProjects: projects.length,
      visibleTasks: tasks.length,
      visibleQuickTasks: quickTasks.length,
    },
    workspaces: workspacePayload,
  };
}

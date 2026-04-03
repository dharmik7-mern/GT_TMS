import mongoose from 'mongoose';
import { getTenantModels } from '../config/tenantDb.js';

export async function getOverview(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const { Task, QuickTask, Team, Project } = await getTenantModels(companyId);

    if (!companyId || !workspaceId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const baseFilter = {
      tenantId: new mongoose.Types.ObjectId(companyId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      status: 'in_progress'
    };

    const isAdminOrManager = ['super_admin', 'admin', 'owner', 'workspace_admin', 'system_admin'].includes(role);
    const uid = new mongoose.Types.ObjectId(userId);
    let visibilityIds = [uid];

    if (role === 'team_leader') {
      const ledTeams = await Team.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        $or: [
          { leaderId: uid },
          { leaderIds: uid }
        ]
      }).select('members').lean();

      ledTeams.forEach(team => {
        if (team.members && Array.isArray(team.members)) {
          team.members.forEach(m => {
            if (m && !visibilityIds.some(vid => String(vid) === String(m))) {
              visibilityIds.push(new mongoose.Types.ObjectId(m));
            }
          });
        }
      });
    }

    // Projects where user is a reporting person
    const reportingProjects = await Project.find({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      reportingPersonIds: uid
    }).select('_id').lean();
    const reportingProjectIds = reportingProjects.map(p => p._id);

    const filter = { ...baseFilter };
    if (!isAdminOrManager) {
      const orConditions = [
        { assigneeIds: { $in: visibilityIds } },
        { reporterId: { $in: visibilityIds } },
        { createdBy: { $in: visibilityIds } }
      ];

      if (reportingProjectIds.length > 0) {
        orConditions.push({ projectId: { $in: reportingProjectIds } });
      }
      
      filter.$or = orConditions;
    }

    const tasks = await Task.find(filter)
      .populate('assigneeIds', 'name avatar')
      .populate('reporterId', 'name avatar')
      .populate('projectId', 'name')
      .sort({ dueDate: 1 })
      .lean();

    const qtFilter = { ...filter };
    if (isAdminOrManager && role === 'manager') {
      const privacyOr = [
        { isPrivate: false },
        { isPrivate: { $exists: false } },
        { assigneeIds: uid },
        { createdBy: uid },
        { reporterId: uid }
      ];
      if (qtFilter.$or) {
        const involvedOr = qtFilter.$or;
        delete qtFilter.$or;
        qtFilter.$and = [{ $or: involvedOr }, { $or: privacyOr }];
      } else {
        qtFilter.$or = privacyOr;
      }
    }

    const quickTasks = await QuickTask.find(qtFilter)
      .populate('assigneeIds', 'name avatar')
      .populate('reporterId', 'name avatar')
      .sort({ dueDate: 1 })
      .lean();

    const merged = [
      ...tasks.map(t => ({
        id: t._id,
        title: t.title,
        assignedTo: t.assigneeIds?.[0]?.name || 'Unassigned',
        assigneeAvatar: t.assigneeIds?.[0]?.avatar || '',
        projectId: t.projectId?._id || null,
        projectName: t.projectId?.name || '-',
        type: 'project',
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate
      })),
      ...quickTasks.map(qt => ({
        id: qt._id,
        title: qt.title,
        assignedTo: qt.assigneeIds?.[0]?.name || 'Unassigned',
        assigneeAvatar: qt.assigneeIds?.[0]?.avatar || '',
        projectId: null,
        projectName: '-',
        type: 'quick',
        status: qt.status,
        priority: qt.priority,
        dueDate: qt.dueDate
      }))
    ];

    merged.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

    return res.status(200).json({ success: true, data: merged.slice(0, 7) });
  } catch (err) {
    next(err);
  }
}

export async function getAllTasks(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const { Task, QuickTask, PersonalTask, Team, Project } = await getTenantModels(companyId);

    if (!companyId || !workspaceId) {
      return res.status(200).json({ success: true, data: { projectTasks: [], quickTasks: [], personalTasks: [] } });
    }

    const baseFilter = {
      tenantId: new mongoose.Types.ObjectId(companyId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId)
    };

    const isAdminOrManager = ['super_admin', 'admin', 'owner', 'workspace_admin', 'system_admin'].includes(role);
    const uid = new mongoose.Types.ObjectId(userId);
    let visibilityIds = [uid];

    if (role === 'team_leader') {
      const ledTeams = await Team.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        $or: [
          { leaderId: uid },
          { leaderIds: uid }
        ]
      }).select('members').lean();

      ledTeams.forEach(team => {
        if (team.members && Array.isArray(team.members)) {
          team.members.forEach(m => {
            if (m && !visibilityIds.some(vid => String(vid) === String(m))) {
              visibilityIds.push(new mongoose.Types.ObjectId(m));
            }
          });
        }
      });
    }

    // Projects where user is a reporting person
    const reportingProjects = await Project.find({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      reportingPersonIds: uid
    }).select('_id').lean();
    const reportingProjectIds = reportingProjects.map(p => p._id);

    const taskFilter = { ...baseFilter };
    if (!isAdminOrManager) {
      const orConditions = [
        { assigneeIds: { $in: visibilityIds } },
        { reporterId: { $in: visibilityIds } },
        { createdBy: { $in: visibilityIds } }
      ];

      if (reportingProjectIds.length > 0) {
        orConditions.push({ projectId: { $in: reportingProjectIds } });
      }

      taskFilter.$or = orConditions;
    }

    const tasks = await Task.find(taskFilter)
      .populate('assigneeIds', 'name avatar')
      .populate('reporterId', 'name avatar')
      .populate('projectId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const qtBaseFilter = { ...baseFilter };
    if (isAdminOrManager && role === 'manager') {
      const privacyOr = [
        { isPrivate: false },
        { isPrivate: { $exists: false } },
        { assigneeIds: uid },
        { createdBy: uid },
        { reporterId: uid }
      ];
      if (qtBaseFilter.$or) {
        const involvedOr = qtBaseFilter.$or;
        delete qtBaseFilter.$or;
        qtBaseFilter.$and = [{ $or: involvedOr }, { $or: privacyOr }];
      } else {
        qtBaseFilter.$or = privacyOr;
      }
    } else if (!isAdminOrManager) {
      const orConditionsForQt = [
        { assigneeIds: { $in: visibilityIds } },
        { reporterId: { $in: visibilityIds } },
        { createdBy: { $in: visibilityIds } }
      ];
      qtBaseFilter.$or = orConditionsForQt;
    }

    const quickTasks = await QuickTask.find(qtBaseFilter)
      .populate('assigneeIds', 'name avatar')
      .populate('reporterId', 'name avatar')
      .sort({ createdAt: -1 })
      .lean();

    const personalTasks = await PersonalTask.find({ userId: uid })
      .sort({ createdAt: -1 })
      .lean();

    const mappedTasks = tasks.map(t => ({
      id: String(t._id),
      title: t.title,
      assignedTo: t.assigneeIds?.[0]?.name || 'Unassigned',
      assigneeAvatar: t.assigneeIds?.[0]?.avatar,
      assigneeIds: (t.assigneeIds || []).map((assignee) => String(assignee?._id || assignee)).filter(Boolean),
      reporterId: t.reporterId ? String(t.reporterId._id || t.reporterId) : undefined,
      reporterName: t.reporterId?.name,
      reporterAvatar: t.reporterId?.avatar,
      projectId: t.projectId?._id ? String(t.projectId._id) : null,
      projectName: t.projectId?.name || '-',
      type: 'project',
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      estimatedHours: t.estimatedHours ?? undefined,
      subtasks: t.subtasks || [],
      attachments: t.attachments || [],
      description: t.description || '',
    }));

    const mappedQuickTasks = quickTasks.map(qt => ({
      id: String(qt._id),
      title: qt.title,
      assignedTo: qt.assigneeIds?.[0]?.name || 'Unassigned',
      assigneeAvatar: qt.assigneeIds?.[0]?.avatar,
      assigneeIds: (qt.assigneeIds || []).map((assignee) => String(assignee?._id || assignee)).filter(Boolean),
      reporterId: qt.reporterId ? String(qt.reporterId._id || qt.reporterId) : undefined,
      reporterName: qt.reporterId?.name,
      reporterAvatar: qt.reporterId?.avatar,
      projectId: null,
      projectName: '-',
      type: 'quick',
      status: qt.status,
      priority: qt.priority,
      dueDate: qt.dueDate,
      estimatedHours: qt.estimatedHours ?? undefined,
      attachments: qt.attachments || [],
      description: qt.description || '',
    }));

    const mappedPersonalTasks = personalTasks.map(pt => ({
      id: pt._id,
      title: pt.title,
      assignedTo: 'Me',
      assigneeAvatar: '',
      projectId: null,
      projectName: 'Personal',
      type: 'personal',
      status: pt.status,
      priority: pt.priority,
      dueDate: pt.dueDate
    }));

    return res.status(200).json({
      success: true,
      data: { projectTasks: mappedTasks, quickTasks: mappedQuickTasks, personalTasks: mappedPersonalTasks }
    });
  } catch (err) {
    next(err);
  }
}

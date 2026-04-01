import mongoose from 'mongoose';
import { getTenantModels } from '../config/tenantDb.js';

export async function getOverview(req, res, next) {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const { Task, QuickTask } = await getTenantModels(companyId);

     const isManagerOrAdmin = ['owner', 'admin', 'manager', 'team_leader', 'workspace_admin', 'system_admin', 'super_admin'].includes(role);
    
    if (!companyId || !workspaceId) {
       return res.status(200).json({ success: true, data: [] });
    }

     const filter = { 
       tenantId: new mongoose.Types.ObjectId(companyId), 
       workspaceId: new mongoose.Types.ObjectId(workspaceId), 
       status: 'in_progress' 
     };
 
     if (!isManagerOrAdmin) {
       filter.$or = [{ assigneeIds: userId }, { reporterId: userId }];
     }

    const tasks = await Task.find(filter)
      .populate('assigneeIds', 'name avatar')
      .populate('reporterId', 'name avatar')
      .populate('projectId', 'name')
      .sort({ dueDate: 1 })
      .lean();

     const isAdmin = ['super_admin', 'admin'].includes(role);
     const qtFilter = { ...filter };
     if (!isAdmin && role === 'manager') {
       const uid = new mongoose.Types.ObjectId(userId);
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
     } else if (!isAdmin) {
       qtFilter.$or = [
         { assigneeIds: userId },
         { reporterId: userId },
         { createdBy: userId },
       ];
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
    const { Task, QuickTask, PersonalTask } = await getTenantModels(companyId);

    if (!companyId || !workspaceId) {
       return res.status(200).json({ success: true, data: { projectTasks: [], quickTasks: [], personalTasks: [] } });
    }

    const baseFilter = { 
        tenantId: new mongoose.Types.ObjectId(companyId), 
        workspaceId: new mongoose.Types.ObjectId(workspaceId)
    };

    // Project tasks are fetched without role restriction to ensure visibility for all tasks associated to the project
    const tasks = await Task.find(baseFilter)
      .populate('assigneeIds', 'name avatar')
      .populate('reporterId', 'name avatar')
      .populate('projectId', 'name')
      .sort({ createdAt: -1 })
      .lean();

     const isAdmin = ['super_admin', 'admin'].includes(role);
     const qtBaseFilter = { ...baseFilter };
     if (!isAdmin && role === 'manager') {
       const uid = new mongoose.Types.ObjectId(userId);
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
     } else if (!isAdmin) {
       qtBaseFilter.$or = [
         { assigneeIds: userId },
         { reporterId: userId },
         { createdBy: userId },
       ];
     }

    const quickTasks = await QuickTask.find(qtBaseFilter)
      .populate('assigneeIds', 'name avatar')
      .populate('reporterId', 'name avatar')
      .sort({ createdAt: -1 })
      .lean();

    const personalTasks = await PersonalTask.find({ userId: new mongoose.Types.ObjectId(userId) })
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

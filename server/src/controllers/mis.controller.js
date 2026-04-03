import { getTenantModels } from '../config/tenantDb.js';
import mongoose from 'mongoose';

// CREATE MIS
export async function createMIS(req, res, next) {
  try {
    const { companyId, workspaceId } = req.auth;
    const userId = req.auth.sub || req.auth.id;
    const { MIS } = await getTenantModels(companyId);
    
    const { week, projectId, goals, learnings, keyTasks, status } = req.body;
    
    const newMis = new MIS({
      tenantId: companyId,
      workspaceId,
      employeeId: userId,
      week,
      projectId: projectId || undefined,
      goals: goals || [],
      learnings: learnings || [],
      keyTasks: keyTasks || [],
      status: status || 'draft'
    });
    
    await newMis.save();
    return res.status(201).json({ success: true, data: newMis });
  } catch (e) {
    console.error("createMIS Error:", e);
    return res.status(500).json({ success: false, message: e.message, stack: e.stack });
  }
}

// GET SINGLE MIS
export async function getMISById(req, res, next) {
  try {
    const { companyId } = req.auth;
    const { MIS } = await getTenantModels(companyId);
    
    const mis = await MIS.findOne({ _id: req.params.id, tenantId: companyId })
      .populate({ path: 'employeeId', model: 'User', select: 'name email avatar' })
      .populate({ path: 'projectId', model: 'Project', select: 'name' });
    if (!mis) return res.status(404).json({ success: false, message: 'MIS not found' });
    
    return res.status(200).json({ success: true, data: mis });
  } catch (e) {
    next(e);
  }
}

// GET MIS BY EMPLOYEE
export async function getMISByEmployee(req, res, next) {
  try {
    const { companyId } = req.auth;
    const userId = req.auth.sub || req.auth.id;
    const { MIS } = await getTenantModels(companyId);
    
    const misList = await MIS.find({ 
      employeeId: req.params.employeeId === 'me' ? userId : req.params.employeeId, 
      tenantId: companyId 
    }).sort({ createdAt: -1 }).populate({ path: 'projectId', model: 'Project', select: 'name' });
    
    return res.status(200).json({ success: true, data: misList });
  } catch (e) {
    next(e);
  }
}

// UPDATE MIS
export async function updateMIS(req, res, next) {
  try {
    const { companyId } = req.auth;
    const userId = req.auth.sub || req.auth.id;
    const { MIS } = await getTenantModels(companyId);
    
    const misId = req.body.id || req.body._id; // client may pass ID in body
    if (!misId) return res.status(400).json({ success: false, message: 'MIS ID is required' });

    const mis = await MIS.findOne({ _id: misId, tenantId: companyId });
    if (!mis) return res.status(404).json({ success: false, message: 'MIS not found' });
    
    // Only allow editing in draft or rejected mode
    if (mis.status !== 'draft' && mis.status !== 'rejected') {
      return res.status(403).json({ success: false, message: 'Only draft or rejected MIS can be updated' });
    }
    
    // Check permission
    if (mis.employeeId.toString() !== userId && !['super_admin', 'admin', 'manager'].includes(req.auth.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this MIS' });
    }
    
    const allowedUpdates = ['week', 'projectId', 'goals', 'learnings', 'keyTasks'];
    allowedUpdates.forEach(key => {
      if (req.body[key] !== undefined) {
        mis[key] = req.body[key];
      }
    });
    
    await mis.save();
    return res.status(200).json({ success: true, data: mis });
  } catch (e) {
    console.error("updateMIS Error:", e);
    return res.status(500).json({ success: false, message: e.message, stack: e.stack });
  }
}

// SUBMIT MIS
export async function submitMIS(req, res, next) {
  try {
    const { companyId } = req.auth;
    const userId = req.auth.sub || req.auth.id;
    const { MIS } = await getTenantModels(companyId);
    
    const misId = req.body.id || req.body._id;
    const mis = await MIS.findOne({ _id: misId, tenantId: companyId });
    if (!mis) return res.status(404).json({ success: false, message: 'MIS not found' });
    
    if (mis.employeeId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    if (mis.status !== 'draft' && mis.status !== 'rejected') {
      return res.status(400).json({ success: false, message: 'Only Draft or Rejected MIS can be submitted' });
    }
    
    mis.status = 'submitted';
    await mis.save();
    
    return res.status(200).json({ success: true, data: mis, message: 'MIS submitted successfully' });
  } catch (e) {
    next(e);
  }
}

// GET PENDING MIS (MANAGER)
export async function getPendingMIS(req, res, next) {
  try {
    const { companyId } = req.auth;
    const { MIS } = await getTenantModels(companyId);
    
    const misList = await MIS.find({ 
                               tenantId: companyId, 
                               status: { $in: ['submitted', 'approved', 'rejected'] } 
                             })
                             .populate({ path: 'employeeId', model: 'User', select: 'name avatar' })
                             .populate({ path: 'projectId', model: 'Project', select: 'name' })
                             .sort({ updatedAt: -1 });
                             
    return res.status(200).json({ success: true, data: misList });
  } catch (e) {
    next(e);
  }
}

// APPROVE MIS (MANAGER)
export async function approveMIS(req, res, next) {
  try {
    const { companyId } = req.auth;
    const { MIS } = await getTenantModels(companyId);
    
    const misId = req.body.id || req.body._id;
    const managerComment = req.body.managerComment || '';
    
    const mis = await MIS.findOne({ _id: misId, tenantId: companyId });
    if (!mis) return res.status(404).json({ success: false, message: 'MIS not found' });
    
    mis.status = 'approved';
    mis.managerComment = managerComment;
    await mis.save();
    
    return res.status(200).json({ success: true, data: mis, message: 'MIS approved' });
  } catch (e) {
    next(e);
  }
}

// REJECT MIS (MANAGER)
export async function rejectMIS(req, res, next) {
  try {
    const { companyId } = req.auth;
    const { MIS } = await getTenantModels(companyId);
    
    const misId = req.body.id || req.body._id;
    const managerComment = req.body.managerComment;
    
    if (!managerComment) {
      return res.status(400).json({ success: false, message: 'Comment is mandatory for rejection' });
    }
    
    const mis = await MIS.findOne({ _id: misId, tenantId: companyId });
    if (!mis) return res.status(404).json({ success: false, message: 'MIS not found' });
    
    mis.status = 'rejected';
    mis.managerComment = managerComment;
    await mis.save();
    
    return res.status(200).json({ success: true, data: mis, message: 'MIS rejected' });
  } catch (e) {
    next(e);
  }
}

// REPORTS: WEEKLY
export async function getReportWeekly(req, res, next) {
  try {
    const { companyId } = req.auth;
    const { week } = req.query; // optional filter
    const { MIS } = await getTenantModels(companyId);
    
    const query = { tenantId: companyId };
    if (week) query.week = week;
    
    const reports = await MIS.find(query)
      .populate('employeeId', 'name email avatar')
      .lean();
      
    const formatted = reports.map(r => ({
      id: r._id,
      employeeName: r.employeeId?.name || 'Unknown',
      avatar: r.employeeId?.avatar,
      week: r.week,
      totalGoals: r.goals.length,
      completedGoals: r.goals.filter(g => g.status === 'Done').length,
      pendingGoals: r.goals.filter(g => g.status !== 'Done').length,
      status: r.status
    }));
      
    return res.status(200).json({ success: true, data: formatted });
  } catch (e) {
    next(e);
  }
}

// REPORTS: EMPLOYEE
export async function getReportEmployee(req, res, next) {
  try {
    const { companyId } = req.auth;
    const { MIS, User } = await getTenantModels(companyId);
    
    const pipelines = [
      { $match: { tenantId: new mongoose.Types.ObjectId(companyId) } },
      { $unwind: "$keyTasks" },
      {
        $group: {
          _id: "$employeeId",
          totalTasks: { $sum: 1 },
          completedTasks: { $sum: { $cond: [{ $eq: ["$keyTasks.status", "Done"] }, 1, 0] } }
        }
      }
    ];
    
    const stats = await MIS.aggregate(pipelines);
    const users = await User.find({ tenantId: companyId, role: { $nin: ['admin', 'super_admin'] } }, 'name avatar').lean();
    
    const data = users.map(u => {
      const s = stats.find(stat => stat._id.toString() === u._id.toString());
      const total = s?.totalTasks || 0;
      const completed = s?.completedTasks || 0;
      const efficiency = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      return {
        id: u._id,
        employeeName: u.name,
        avatar: u.avatar,
        totalTasks: total,
        completedTasks: completed,
        pendingTasks: total - completed,
        efficiency
      };
    });
    
    return res.status(200).json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

// REPORTS: PROJECT
export async function getReportProject(req, res, next) {
  try {
    const { companyId } = req.auth;
    const { MIS, Project } = await getTenantModels(companyId);
    
    const pipelines = [
      { $match: { tenantId: new mongoose.Types.ObjectId(companyId), projectId: { $exists: true, $ne: null } } },
      { $unwind: "$keyTasks" },
      {
        $group: {
          _id: {
             projectId: "$projectId",
             employeeId: "$employeeId"
          },
          completedTasks: { $sum: { $cond: [{ $eq: ["$keyTasks.status", "Done"] }, 1, 0] } },
          pendingTasks: { $sum: { $cond: [{ $ne: ["$keyTasks.status", "Done"] }, 1, 0] } },
          statusArray: { $push: "$status" }
        }
      }
    ];
    
    const stats = await MIS.aggregate(pipelines);
    
    // population for aggregation results
    await MIS.populate(stats, { path: "_id.projectId", model: "Project", select: "name" });
    await MIS.populate(stats, { path: "_id.employeeId", model: "User", select: "name avatar" });
    
    const data = stats.map(s => {
      // average status or most common status? We can just pick the first or derive one.
      const status = s.statusArray.includes('draft') ? 'In Progress' : 'Aligned';
      
      return {
        projectId: s._id.projectId?._id,
        projectName: s._id.projectId?.name || 'Unknown',
        employeeId: s._id.employeeId?._id,
        employeeName: s._id.employeeId?.name || 'Unknown',
        avatar: s._id.employeeId?.avatar,
        completedTasks: s.completedTasks,
        pendingTasks: s.pendingTasks,
        status
      };
    });
    
    return res.status(200).json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

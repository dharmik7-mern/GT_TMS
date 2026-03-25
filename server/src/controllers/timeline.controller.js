import { getTenantModels } from '../config/tenantDb.js';

export const getTimeline = async (req, res, next) => {
  try {
    const { companyId } = req.user || req.auth;
    const { projectId } = req.params;
    const { ProjectTimeline } = await getTenantModels(companyId);

    const timeline = await ProjectTimeline.findOne({ projectId });
    if (!timeline) {
      return res.status(200).json({ success: true, data: null });
    }
    res.status(200).json({ success: true, data: timeline });
  } catch (error) {
    next(error);
  }
};

export const upsertTimeline = async (req, res, next) => {
  try {
    const { companyId, id: userId, role } = req.user || req.auth;
    const { projectId } = req.params;
    const { tasks, status } = req.body;
    const { ProjectTimeline } = await getTenantModels(companyId);

    const existing = await ProjectTimeline.findOne({ projectId });

    if (existing && existing.status === 'Approved' && role !== 'admin' && role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Timeline is approved and locked. Only admins can edit.' });
    }

    const updatedTimeline = await ProjectTimeline.findOneAndUpdate(
      { projectId },
      { projectId, tasks, status, createdBy: userId },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: updatedTimeline });
  } catch (error) {
    next(error);
  }
};

export const lockTimeline = async (req, res, next) => {
  try {
    const { companyId, role } = req.user || req.auth;
    const { projectId } = req.params;
    const { ProjectTimeline } = await getTenantModels(companyId);

    if (role !== 'admin' && role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only admins can approve/lock the timeline.' });
    }

    const timeline = await ProjectTimeline.findOneAndUpdate(
      { projectId },
      { status: 'Approved' },
      { new: true }
    );

    if (!timeline) {
      return res.status(404).json({ success: false, message: 'Timeline not found.' });
    }

    res.status(200).json({ success: true, data: timeline });
  } catch (error) {
    next(error);
  }
};

export const unlockTimeline = async (req, res, next) => {
  try {
    const { companyId, role } = req.user || req.auth;
    const { projectId } = req.params;
    const { ProjectTimeline } = await getTenantModels(companyId);

    if (role !== 'admin' && role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only admins can unlock the timeline.' });
    }

    const timeline = await ProjectTimeline.findOneAndUpdate(
      { projectId },
      { status: 'Draft' },
      { new: true }
    );

    if (!timeline) {
      return res.status(404).json({ success: false, message: 'Timeline not found.' });
    }

    res.status(200).json({ success: true, data: timeline });
  } catch (error) {
    next(error);
  }
};

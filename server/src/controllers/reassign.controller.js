import * as reassignService from '../services/reassign.service.js';

export const createRequest = async (req, res, next) => {
  try {
    const { taskId, requestedAssigneeId, note } = req.body;
    const { companyId, sub: userId } = req.auth;
    const request = await reassignService.createReassignRequest({
      companyId,
      userId,
      taskId,
      requestedAssigneeId,
      note
    });
    res.status(201).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

export const getRequests = async (req, res, next) => {
  try {
    const { companyId, sub: userId, role } = req.auth;
    const list = await reassignService.getReassignRequests({
      companyId,
      userId,
      role
    });
    res.json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
};

export const approveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyId, sub: userId } = req.auth;
    const request = await reassignService.handleReassignRequest({
      companyId,
      userId,
      requestId: id,
      approve: true
    });
    res.json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

export const rejectRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const { companyId, sub: userId } = req.auth;
    const request = await reassignService.handleReassignRequest({
      companyId,
      userId,
      requestId: id,
      approve: false,
      rejectionNote: note
    });
    res.json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

export const getStatusForTask = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const { companyId } = req.auth;
        const request = await reassignService.getRequestStatusForTask({
            companyId,
            taskId
        });
        res.json({ success: true, data: request });
    } catch (error) {
        next(error);
    }
};

import * as taskExtensionService from '../services/taskExtension.service.js';

export const createExtensionRequest = async (req, res, next) => {
  try {
    const { companyId, workspaceId, sub: userId } = req.auth;
    const request = await taskExtensionService.createExtensionRequest({
      companyId,
      workspaceId,
      userId,
      data: req.body
    });
    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
};

export const listExtensionRequests = async (req, res, next) => {
  try {
    const { companyId, workspaceId, sub: userId, role } = req.auth;
    const requests = await taskExtensionService.listExtensionRequests({
      companyId,
      workspaceId,
      userId,
      role
    });
    res.json(requests);
  } catch (err) {
    next(err);
  }
};

export const approveExtensionRequest = async (req, res, next) => {
  try {
    const { companyId, workspaceId, sub: userId } = req.auth;
    const { id } = req.params;
    const { comment } = req.body;
    const request = await taskExtensionService.approveExtensionRequest({
      companyId,
      workspaceId,
      userId,
      requestId: id,
      comment
    });
    res.json(request);
  } catch (err) {
    next(err);
  }
};

export const rejectExtensionRequest = async (req, res, next) => {
  try {
    const { companyId, workspaceId, sub: userId } = req.auth;
    const { id } = req.params;
    const { comment } = req.body;
    const request = await taskExtensionService.rejectExtensionRequest({
      companyId,
      workspaceId,
      userId,
      requestId: id,
      comment
    });
    res.json(request);
  } catch (err) {
    next(err);
  }
};

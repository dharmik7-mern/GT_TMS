import express from 'express';
import * as reassignController from '../../../controllers/reassign.controller.js';
import { authenticate } from '../../../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

router.post('/reassign-request', reassignController.createRequest);
router.get('/reassign-requests', reassignController.getRequests);
router.put('/reassign-request/:id/approve', reassignController.approveRequest);
router.put('/reassign-request/:id/reject', reassignController.rejectRequest);
router.get('/reassign-request/status/:taskId', reassignController.getStatusForTask);

export default router;

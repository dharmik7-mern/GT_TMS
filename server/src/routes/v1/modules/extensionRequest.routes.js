import express from 'express';
import * as extensionRequestController from '../../../controllers/extensionRequest.controller.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';

const router = express.Router();

router.use(requireAuth);

router.post('/', extensionRequestController.createExtensionRequest);
router.get('/', extensionRequestController.listExtensionRequests);
router.put('/:id/approve', extensionRequestController.approveExtensionRequest);
router.put('/:id/reject', extensionRequestController.rejectExtensionRequest);

export default router;

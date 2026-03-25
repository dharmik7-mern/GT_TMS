import express from 'express';
import { verifyToken } from '../../../middleware/auth.middleware.js';
import * as TimelineController from '../../../controllers/timeline.controller.js';

const router = express.Router();

router.get('/:projectId', verifyToken, TimelineController.getTimeline);
router.post('/:projectId', verifyToken, TimelineController.upsertTimeline);
router.patch('/:projectId/lock', verifyToken, TimelineController.lockTimeline);
router.patch('/:projectId/unlock', verifyToken, TimelineController.unlockTimeline);

export default router;

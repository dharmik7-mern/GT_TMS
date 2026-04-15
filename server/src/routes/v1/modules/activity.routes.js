import express from 'express';

import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import * as ActivityController from '../../../controllers/activity.controller.js';

const router = express.Router();
router.use(requireAuth);
router.use(requireRole(['super_admin', 'admin', 'company_admin', 'manager', 'team_leader', 'team_member']));

router.get('/', ActivityController.list);
router.get('/project/:projectId/timeline', ActivityController.getProjectTimeline);
router.get('/project/:projectId', ActivityController.getByProject);

export default router;



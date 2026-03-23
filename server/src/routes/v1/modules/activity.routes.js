import express from 'express';

import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import * as ActivityController from '../../../controllers/activity.controller.js';

const router = express.Router();
router.use(requireAuth);
router.use(requireRole(['super_admin', 'admin', 'manager', 'team_leader']));

router.get('/', ActivityController.list);

export default router;


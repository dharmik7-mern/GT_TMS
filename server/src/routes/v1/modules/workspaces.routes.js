import express from 'express';

import { requireAuth } from '../../../middleware/auth.middleware.js';
import * as WorkspacesController from '../../../controllers/workspaces.controller.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', WorkspacesController.list);
router.put('/:id', WorkspacesController.update);
router.get('/:id/export', WorkspacesController.exportData);

export default router;


import express from 'express';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import * as SettingsController from '../../../controllers/settings.controller.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireRole(['super_admin', 'admin', 'company_admin']));

router.get('/system', SettingsController.getSystem);
router.put('/system', SettingsController.updateSystem);
router.post('/system/clear-cache', SettingsController.clearCache);
router.post('/system/refresh', SettingsController.refreshData);
router.post('/system/test-email', SettingsController.testEmail);

export default router;

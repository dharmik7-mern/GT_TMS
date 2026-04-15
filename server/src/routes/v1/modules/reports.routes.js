import express from 'express';
import {
  getReportWeekly,
  getReportEmployee,
  getReportProject,
  getDailyReports,
  getDailyLatest,
  triggerDailyRun,
} from '../../../controllers/reports.controller.js';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';

const router = express.Router();

router.use(requireAuth);

router.get('/weekly', getReportWeekly);
router.get('/employee', getReportEmployee);
router.get('/project', getReportProject);
router.get('/daily', getDailyReports);
router.get('/daily/latest', getDailyLatest);
router.post('/daily/run', requireRole(['super_admin', 'admin', 'company_admin', 'manager']), triggerDailyRun);

export default router;

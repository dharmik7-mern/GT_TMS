import express from 'express';
import { z } from 'zod';

import { validateBody } from '../../../middleware/validate.middleware.js';
import { requireIntegrationKey } from '../../../middleware/integration.middleware.js';
import * as HrmsIntegrationController from '../../../controllers/hrmsIntegration.controller.js';

const router = express.Router();

const dashboardRequestSchema = z.object({
  email: z.string().trim().email().max(200),
  includeCompleted: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(200).optional().default(50),
  companyId: z.string().trim().optional(),
  companyCode: z.string().trim().optional(),
});

router.post(
  '/dashboard',
  requireIntegrationKey,
  validateBody(dashboardRequestSchema),
  HrmsIntegrationController.getDashboard
);

export default router;

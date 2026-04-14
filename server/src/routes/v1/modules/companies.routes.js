import express from 'express';
import { z } from 'zod';

import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import { validateBody } from '../../../middleware/validate.middleware.js';
import * as CompaniesController from '../../../controllers/companies.controller.js';

const router = express.Router();
router.use(requireAuth);
router.use(requireRole(['super_admin']));

router.get('/', CompaniesController.list);
router.post(
  '/',
  validateBody(
    z.object({
      name: z.string().trim().min(2).max(200),
      adminName: z.string().trim().min(2).max(120),
      adminEmail: z.string().trim().email().max(200),
      adminPassword: z.string().min(4).max(200),
      organizationId: z.string().trim().min(1).max(80).optional(),
      initialUserLimit: z.number().int().min(1).max(100000).optional(),
      status: z.enum(['active', 'trial', 'suspended']).default('active'),
    })
  ),
  CompaniesController.create
);
router.put(
  '/:id',
  validateBody(
    z.object({
      name: z.string().trim().min(2).max(200),
      adminEmail: z.string().trim().email().max(200),
      status: z.enum(['active', 'trial', 'suspended']).default('active'),
    })
  ),
  CompaniesController.update
);

export default router;


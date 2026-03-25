import express from 'express';
import { z } from 'zod';

import { requireAuth } from '../../../middleware/auth.middleware.js';
import { validateBody } from '../../../middleware/validate.middleware.js';
import * as ProjectsController from '../../../controllers/projects.controller.js';

const router = express.Router();

router.use(requireAuth);

const projectCreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  color: z.string().trim().min(3).max(32),
  status: z.enum(['active', 'on_hold', 'completed', 'archived']).optional(),
  department: z.string().trim().max(120).optional(),
  members: z.array(z.string()).optional(),
  reportingPersonIds: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().min(0).optional().nullable(),
  budgetCurrency: z.string().trim().max(8).optional(),
  sdlcPlan: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    durationDays: z.number().min(0).max(3650),
    notes: z.string().trim().max(500).optional().or(z.literal('')),
  })).max(20).optional(),
});

const projectUpdateSchema = projectCreateSchema.partial();

router.get('/', ProjectsController.list);
router.post('/', validateBody(projectCreateSchema), ProjectsController.create);
router.get('/:id', ProjectsController.get);
router.put('/:id', validateBody(projectUpdateSchema), ProjectsController.update);
router.delete('/:id', ProjectsController.remove);

export default router;


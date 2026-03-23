import express from 'express';
import { z } from 'zod';

import { requireAuth } from '../../../middleware/auth.middleware.js';
import { validateBody } from '../../../middleware/validate.middleware.js';
import * as TeamsController from '../../../controllers/teams.controller.js';

const router = express.Router();

router.use(requireAuth);

const teamCreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  leaderId: z.string().optional(),
  members: z.array(z.string()).optional(),
  projectIds: z.array(z.string()).optional(),
  color: z.string().trim().min(3).max(32),
});

router.get('/', TeamsController.list);
router.post('/', validateBody(teamCreateSchema), TeamsController.create);

export default router;


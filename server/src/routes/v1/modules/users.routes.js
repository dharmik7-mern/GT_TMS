import express from 'express';
import { z } from 'zod';

import { requireAuth } from '../../../middleware/auth.middleware.js';
import { validateBody } from '../../../middleware/validate.middleware.js';
import * as UsersController from '../../../controllers/users.controller.js';

const router = express.Router();
router.use(requireAuth);

router.get('/me', UsersController.me);
router.put('/me', UsersController.updateMe);
router.put('/me/preferences', UsersController.updateMyPreferences);
router.put('/me/password', UsersController.updateMyPassword);
router.post(
  '/',
  validateBody(
    z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(200),
      password: z.string().min(8).max(200),
      role: z.enum(['super_admin', 'admin', 'manager', 'team_leader', 'team_member']),
      companyId: z.string().trim().min(1).optional(),
      jobTitle: z.string().trim().max(120).optional(),
      department: z.string().trim().max(120).optional(),
      color: z.string().trim().max(32).optional(),
    })
  ),
  UsersController.create
);
router.put(
  '/:id',
  validateBody(
    z.object({
      name: z.string().trim().min(2).max(120).optional(),
      email: z.string().trim().email().max(200).optional(),
      role: z.enum(['super_admin', 'admin', 'manager', 'team_leader', 'team_member']).optional(),
      jobTitle: z.string().trim().max(120).optional(),
      department: z.string().trim().max(120).optional(),
      isActive: z.boolean().optional(),
      color: z.string().trim().max(32).optional(),
    })
  ),
  UsersController.update
);
router.delete('/:id', UsersController.remove);
router.get('/', UsersController.list);
router.get('/:id', UsersController.get);

export default router;


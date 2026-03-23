import express from 'express';
import { z } from 'zod';

import { requireAuth } from '../../../middleware/auth.middleware.js';
import { validateBody } from '../../../middleware/validate.middleware.js';
import * as NotificationsController from '../../../controllers/notifications.controller.js';

const router = express.Router();
router.use(requireAuth);

router.get('/broadcast-history', NotificationsController.listBroadcastHistory);
router.post(
  '/broadcast',
  validateBody(
    z.object({
      targetType: z.enum(['all', 'company', 'user']),
      companyId: z.string().trim().optional(),
      companyName: z.string().trim().optional(),
      userEmail: z.string().trim().email().optional(),
      messageType: z.enum(['info', 'success', 'warning', 'urgent']),
      title: z.string().trim().min(2).max(200),
      message: z.string().trim().min(2).max(2000),
    }).superRefine((data, ctx) => {
      if (data.targetType === 'company' && !data.companyId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'companyId is required for company broadcasts', path: ['companyId'] });
      }
      if (data.targetType === 'user' && !data.userEmail) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'userEmail is required for user broadcasts', path: ['userEmail'] });
      }
    })
  ),
  NotificationsController.broadcast
);
router.get('/', NotificationsController.list);
router.patch('/:id/read', NotificationsController.markRead);
router.patch('/read-all', NotificationsController.markAllRead);

export default router;


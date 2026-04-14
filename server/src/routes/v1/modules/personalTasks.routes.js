import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { validateBody } from '../../../middleware/validate.middleware.js';
import * as PersonalTasksController from '../../../controllers/personalTasks.controller.js';

const router = express.Router();
router.use(requireAuth);

const personalTaskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(10000).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.string().optional().nullable(),
  dueTime: z.string().optional().nullable(),
  labels: z.array(z.string()).optional(),
  reminder: z.object({
    enabled: z.boolean().optional(),
    at: z.string().optional().nullable(),
  }).optional(),
  isPinned: z.boolean().optional(),
  order: z.number().optional(),
  completedAt: z.string().optional().nullable(),
  repeatSchedule: z.string().optional(),
});

router.get('/', PersonalTasksController.list);
router.get('/stats', PersonalTasksController.stats);
router.post('/', validateBody(personalTaskSchema), PersonalTasksController.create);
router.put('/:id', validateBody(personalTaskSchema.partial()), PersonalTasksController.update);
router.patch('/:id/toggle-pinned', PersonalTasksController.togglePinned);
router.delete('/:id', PersonalTasksController.remove);

export default router;

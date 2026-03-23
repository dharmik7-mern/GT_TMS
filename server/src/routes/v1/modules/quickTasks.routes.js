import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

import { requireAuth } from '../../../middleware/auth.middleware.js';
import { validateBody } from '../../../middleware/validate.middleware.js';
import * as QuickTasksController from '../../../controllers/quickTasks.controller.js';

const router = express.Router();
router.use(requireAuth);

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (_req, file, cb) {
    cb(null, Date.now() + '-' + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

const createSchema = z.object({
  title: z.string().trim().min(2).max(300),
  description: z.string().trim().max(10000).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeIds: z.array(z.string()).optional().nullable(),
  // Backwards compat: allow single assigneeId, service converts to assigneeIds[]
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional(),
  completionRemark: z.string().trim().max(5000).optional(),
});

const addCommentSchema = z.object({
  content: z.string().trim().min(1).max(8000),
});

const reviewQuickTaskSchema = z.object({
  action: z.enum(['approve', 'changes_requested']),
  reviewRemark: z.string().trim().max(5000).optional(),
});

router.get('/', QuickTasksController.list);
router.post('/', validateBody(createSchema), QuickTasksController.create);
router.put('/:id', validateBody(createSchema.partial()), QuickTasksController.update);
router.delete('/:id', QuickTasksController.remove);

router.post('/:id/comments', validateBody(addCommentSchema), QuickTasksController.addComment);
router.post('/:id/review', validateBody(reviewQuickTaskSchema), QuickTasksController.review);

router.post('/:id/attachments', upload.array('files', 10), QuickTasksController.uploadAttachments);

export default router;


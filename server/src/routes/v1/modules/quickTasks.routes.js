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

const optionalTrimmedString = (max) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    },
    z.string().max(max).optional()
  );

const optionalEmailString = () =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    },
    z.string().email().max(200).optional()
  );

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
  isPrivate: z.boolean().optional(),
});

const importSchema = z.object({
  rows: z.array(
    z.object({
      rowNumber: z.number().int().positive().optional(),
      title: z.string().trim().min(2).max(300),
      description: optionalTrimmedString(10000),
      status: z.enum(['todo', 'in_progress', 'done']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      assigneeEmails: optionalTrimmedString(1000),
      assigneeNames: optionalTrimmedString(1000),
      reporterEmail: optionalEmailString(),
      reporterName: optionalTrimmedString(200),
      dueDate: optionalTrimmedString(50),
      createdAt: optionalTrimmedString(50),
      updatedAt: optionalTrimmedString(50),
    })
  ).min(1).max(500),
});

const addCommentSchema = z.object({
  content: z.string().trim().min(1).max(8000),
});

const reviewQuickTaskSchema = z.object({
  action: z.enum(['approve', 'changes_requested']),
  rating: z.number().min(1).max(5).optional(),
  reviewRemark: z.string().trim().max(5000).optional(),
});

router.get('/', QuickTasksController.list);
router.post('/', validateBody(createSchema), QuickTasksController.create);
router.post('/import', validateBody(importSchema), QuickTasksController.importBulk);
router.put('/:id', validateBody(createSchema.partial()), QuickTasksController.update);
router.delete('/:id', QuickTasksController.remove);

router.post('/:id/comments', validateBody(addCommentSchema), QuickTasksController.addComment);
router.post('/:id/review', validateBody(reviewQuickTaskSchema), QuickTasksController.review);

router.post('/:id/attachments', upload.array('files', 10), QuickTasksController.uploadAttachments);

export default router;


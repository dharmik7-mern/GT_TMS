import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

import { requireAuth } from '../../../middleware/auth.middleware.js';
import { validateBody } from '../../../middleware/validate.middleware.js';
import * as TasksController from '../../../controllers/tasks.controller.js';
import * as AllTasksController from '../../../controllers/allTasks.controller.js';
import * as ReassignController from '../../../controllers/reassign.controller.js';
import { isReservedTaskTitle, reservedTaskTitleMessage } from '../../../utils/taskTitleValidation.js';

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

const statusEnum = z.enum(['backlog', 'todo', 'scheduled', 'in_progress', 'in_review', 'blocked', 'done']);
const taskTypeEnum = z.enum(['operational', 'design', 'important']);
const timelineTypeEnum = z.enum(['task', 'milestone']);

const subtaskInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  isCompleted: z.boolean().optional(),
  order: z.number().optional(),
  assigneeId: z.string().optional(),
});

const taskCreateSchema = z.object({
  projectId: z.string().min(10),
  title: z.string().trim().min(2).max(300).refine((value) => !isReservedTaskTitle(value), {
    message: reservedTaskTitleMessage(),
  }),
  description: z.string().trim().max(10000).optional(),
  status: statusEnum.optional(),
  taskType: taskTypeEnum.optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeIds: z.array(z.string()).optional(),
  dueDate: z.string().optional(),
  startDate: z.string().optional(),
  durationDays: z.number().int().min(1).max(3650),
  phaseId: z.string().optional(),
  subcategoryId: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  type: timelineTypeEnum.optional(),
  estimatedHours: z.number().optional(),
  order: z.number().optional(),
  labels: z.array(z.string()).optional(),
  subtasks: z.array(subtaskInputSchema).optional(),
});

const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(300).refine((value) => !isReservedTaskTitle(value), {
      message: reservedTaskTitleMessage(),
    }).optional(),
    description: z.string().trim().max(10000).optional(),
    status: statusEnum.optional(),
    taskType: taskTypeEnum.optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    assigneeIds: z.array(z.string()).optional(),
    dueDate: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    phaseId: z.string().nullable().optional(),
    dependencies: z.array(z.string()).optional(),
    type: timelineTypeEnum.optional(),
    estimatedHours: z.number().nullable().optional(),
    order: z.number().optional(),
    labels: z.array(z.string()).optional(),
    subtasks: z.array(subtaskInputSchema).optional(),
    completionRemark: z.string().trim().max(5000).optional(),
  })
  .strict();

const moveStatusSchema = z.object({
  status: statusEnum,
});

const reviewTaskSchema = z.object({
  action: z.enum(['approve', 'changes_requested']),
  rating: z.number().min(1).max(5).optional(),
  reviewRemark: z.string().trim().max(5000).optional(),
});

const taskRequestReviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reviewNote: z.string().trim().max(5000).optional(),
});

const addSubtaskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  assigneeId: z.string().optional(),
  isCompleted: z.boolean().optional(),
});

const addCommentSchema = z.object({
  content: z.string().trim().min(1).max(8000),
});

const patchSubtaskSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  isCompleted: z.boolean().optional(),
  order: z.number().optional(),
  assigneeId: z.string().nullable().optional(),
});

router.get('/overview', AllTasksController.getOverview);
router.get('/all', AllTasksController.getAllTasks);
router.get('/requests', TasksController.listTaskRequests);
router.post('/requests', validateBody(taskCreateSchema), TasksController.createTaskRequest);
router.post('/requests/:id/review', validateBody(taskRequestReviewSchema), TasksController.reviewTaskRequest);

// Reassign Requests
router.post('/reassign-request', ReassignController.createRequest);
router.get('/reassign-requests', ReassignController.getRequests);
router.put('/reassign-request/:id/approve', ReassignController.approveRequest);
router.put('/reassign-request/:id/reject', ReassignController.rejectRequest);
router.get('/reassign-request/status/:taskId', ReassignController.getStatusForTask);

router.get('/', TasksController.list);
router.get('/detail/:id', TasksController.getDetail);
router.get('/:id', TasksController.getOne);
router.post('/', validateBody(taskCreateSchema), TasksController.create);
router.put('/:id', validateBody(taskUpdateSchema), TasksController.update);
router.patch('/:id', validateBody(taskUpdateSchema), TasksController.update);
router.delete('/:id', TasksController.remove);
router.patch('/:id/status', validateBody(moveStatusSchema), TasksController.moveStatus);
router.post('/:id/review', validateBody(reviewTaskSchema), TasksController.reviewCompletion);

router.post('/:id/subtasks', validateBody(addSubtaskSchema), TasksController.addSubtask);
router.patch('/:id/subtasks/:subtaskId', validateBody(patchSubtaskSchema), TasksController.patchSubtask);
router.delete('/:id/subtasks/:subtaskId', TasksController.deleteSubtask);

router.post('/:id/attachments', upload.array('files', 10), TasksController.uploadAttachments);
router.post('/:id/comments', validateBody(addCommentSchema), TasksController.addComment);

export default router;

import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { z } from 'zod';

import { requireAuth } from '../../../middleware/auth.middleware.js';
import { enforceIdempotency } from '../../../middleware/idempotency.middleware.js';
import { mutationRateLimiter } from '../../../middleware/rate-limit.middleware.js';
import { validateBody } from '../../../middleware/validate.middleware.js';
import * as TasksController from '../../../controllers/tasks.controller.js';
import * as AllTasksController from '../../../controllers/allTasks.controller.js';
import * as ReassignController from '../../../controllers/reassign.controller.js';
import { isReservedTaskTitle, reservedTaskTitleMessage } from '../../../utils/taskTitleValidation.js';

const router = express.Router();

router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

const statusEnum = z.enum(['todo', 'scheduled', 'in_progress', 'in_review', 'blocked', 'done']);
const taskTypeEnum = z.enum(['operational', 'design', 'important']);
const timelineTypeEnum = z.enum(['task', 'milestone']);
const objectId = z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), { message: 'Invalid ObjectId' });

const subtaskInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  isCompleted: z.boolean().optional(),
  order: z.number().optional(),
  assigneeId: objectId.optional(),
});

const taskCreateSchema = z.object({
  projectId: objectId,
  title: z.string().trim().min(2).max(300).refine((value) => !isReservedTaskTitle(value), {
    message: reservedTaskTitleMessage(),
  }),
  description: z.string().trim().max(10000).optional(),
  status: statusEnum.optional(),
  taskType: taskTypeEnum.optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeIds: z.array(objectId).optional(),
  dueDate: z.string().optional(),
  startDate: z.string().optional(),
  durationDays: z.number().int().min(1).max(3650),
  phaseId: objectId.optional(),
  subcategoryId: objectId.optional(),
  dependencies: z.array(z.string()).optional(),
  type: timelineTypeEnum.optional(),
  estimatedHours: z.number().optional(),
  order: z.number().optional(),
  labels: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
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
    tags: z.array(z.string()).optional(),
    subtasks: z.array(subtaskInputSchema).optional(),
    completionRemark: z.string().trim().max(5000).optional(),
    reviewRemark: z.string().trim().max(5000).optional(),
    rating: z.number().min(1).max(5).optional(),
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
router.post('/requests', mutationRateLimiter, enforceIdempotency(), validateBody(taskCreateSchema), TasksController.createTaskRequest);
router.post('/requests/:id/review', validateBody(taskRequestReviewSchema), TasksController.reviewTaskRequest);

// Reassign Requests
router.post('/reassign-request', ReassignController.createRequest);
router.get('/reassign-requests', ReassignController.getRequests);
router.put('/reassign-request/:id/approve', ReassignController.approveRequest);
router.put('/reassign-request/:id/reject', ReassignController.rejectRequest);
router.get('/reassign-request/status/:taskId', ReassignController.getStatusForTask);

router.get('/overdue', TasksController.getOverdue);
router.get('/', TasksController.list);
router.get('/detail/:id', TasksController.getDetail);
router.get('/:id/activities', TasksController.getActivities);
router.get('/:id/time-tracking', TasksController.getTimeTracking);
router.get('/:id', TasksController.getOne);
router.post('/', mutationRateLimiter, enforceIdempotency(), validateBody(taskCreateSchema), TasksController.create);
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

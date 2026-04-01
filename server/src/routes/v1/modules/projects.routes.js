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
  subcategories: z.array(z.object({
    id: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional().or(z.literal('')),
    color: z.string().trim().min(3).max(32).optional(),
    order: z.number().min(0).optional(),
  })).max(30).optional(),
});

const projectUpdateSchema = projectCreateSchema.partial();

const optionalTrimmedString = (max) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    },
    z.string().max(max).optional()
  );

const importSchema = z.object({
  rows: z.array(
    z.object({
      rowNumber: z.number().int().positive().optional(),
      projectKey: optionalTrimmedString(120),
      projectName: z.string().trim().min(2).max(200),
      projectDescription: optionalTrimmedString(4000),
      projectStatus: z.enum(['active', 'on_hold', 'completed', 'archived']).optional(),
      projectDepartment: optionalTrimmedString(120),
      projectColor: optionalTrimmedString(32),
      memberEmails: optionalTrimmedString(1000),
      memberNames: optionalTrimmedString(1000),
      reportingPersonEmails: optionalTrimmedString(1000),
      reportingPersonNames: optionalTrimmedString(1000),
      startDate: optionalTrimmedString(50),
      endDate: optionalTrimmedString(50),
      budget: z.number().min(0).optional(),
      budgetCurrency: optionalTrimmedString(8),
      sdlcPlan: optionalTrimmedString(2000),
      taskTitle: optionalTrimmedString(300),
      taskDescription: optionalTrimmedString(10000),
      taskStatus: z.enum(['backlog', 'todo', 'scheduled', 'in_progress', 'in_review', 'blocked', 'done']).optional(),
      taskPriority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      taskAssigneeEmails: optionalTrimmedString(1000),
      taskAssigneeNames: optionalTrimmedString(1000),
      taskStartDate: optionalTrimmedString(50),
      taskDurationDays: z.number().int().min(1).max(3650).optional(),
      taskEstimatedHours: z.number().min(0).optional(),
      taskPhase: optionalTrimmedString(120),
      taskSubtasks: optionalTrimmedString(3000),
    })
  ).min(1).max(2000),
});

router.get('/', ProjectsController.list);
router.post('/', validateBody(projectCreateSchema), ProjectsController.create);
router.post('/import', validateBody(importSchema), ProjectsController.importBulk);
router.get('/:id', ProjectsController.get);
router.put('/:id', validateBody(projectUpdateSchema), ProjectsController.update);
router.put('/:id/subcategories', ProjectsController.upsertSubcategories);
router.delete('/:id', ProjectsController.remove);

export default router;

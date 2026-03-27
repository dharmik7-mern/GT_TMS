import express from 'express';
import { z } from 'zod';

import { requireAuth } from '../../../middleware/auth.middleware.js';
import { validateBody } from '../../../middleware/validate.middleware.js';
import * as UsersController from '../../../controllers/users.controller.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();
router.use(requireAuth);

router.get('/me', UsersController.me);
router.get('/me/performance', UsersController.mePerformance);
router.put('/me', UsersController.updateMe);
router.put('/me/preferences', UsersController.updateMyPreferences);
router.put('/me/password', UsersController.updateMyPassword);

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (_req, file, cb) {
    cb(null, 'avatar-' + Date.now() + '-' + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

router.put('/profile-photo', upload.single('avatar'), UsersController.updateProfilePhoto);
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
      canUsePrivateQuickTasks: z.boolean().optional(),
      sendCredentialsEmail: z.boolean().optional(),
    })
  ),
  UsersController.create
);
router.post(
  '/import',
  validateBody(
    z.object({
      rows: z.array(
        z.object({
          rowNumber: z.number().int().positive().optional(),
          name: z.string().trim().min(1).max(120),
          email: z.string().trim().email().max(200),
          password: z.string().min(8).max(200),
          role: z.enum(['super_admin', 'admin', 'manager', 'team_leader', 'team_member']).optional(),
          jobTitle: z.string().trim().max(120).optional(),
          department: z.string().trim().max(120).optional(),
          color: z.string().trim().max(32).optional(),
          canUsePrivateQuickTasks: z.boolean().optional(),
        })
      ).min(1).max(200),
    })
  ),
  UsersController.importBulk
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
      canUsePrivateQuickTasks: z.boolean().optional(),
    })
  ),
  UsersController.update
);
router.delete('/:id', UsersController.remove);
router.get('/', UsersController.list);
router.get('/:id/performance', UsersController.performance);
router.get('/:id', UsersController.get);

export default router;


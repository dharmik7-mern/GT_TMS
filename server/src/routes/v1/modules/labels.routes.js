import express from 'express';
import * as LabelsController from '../../../controllers/labels.controller.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', requireAuth, LabelsController.list);
router.post('/', requireAuth, LabelsController.create);
router.delete('/:id', requireAuth, LabelsController.remove);

export default router;

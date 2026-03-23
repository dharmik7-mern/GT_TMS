import express from 'express';
import { 
    getNotifications, 
    markAsRead, 
    createNotification, 
    clearNotifications 
} from '../../controllers/admin/adminNotification.controller.js';

const router = express.Router();

router.get('/', getNotifications);
router.post('/create', createNotification);
router.put('/:id/read', markAsRead);
router.delete('/clear', clearNotifications);

export default router;

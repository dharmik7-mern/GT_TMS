import express from 'express';
import { getConversations, getMessages, sendMessage, startConversation, createGroup, markAsRead } from '../../controllers/admin/adminChat.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(requireAuth);

router.get('/conversations', getConversations);
router.get('/conversations/:conversationId/messages', getMessages);
router.post('/messages', sendMessage);
router.post('/conversations/start', startConversation);
router.post('/conversations/group', createGroup);
router.post('/conversations/:conversationId/read', markAsRead);

export default router;

import express from 'express';
import { getConversations, getMessages, sendMessage, startConversation, createGroup } from '../../controllers/admin/adminChat.controller.js';
import { verifyToken } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/conversations', getConversations);
router.get('/conversations/:conversationId/messages', getMessages);
router.post('/messages', sendMessage);
router.post('/conversations/start', startConversation);
router.post('/conversations/group', createGroup);

export default router;

import AdminConversation from '../../models/admin/AdminConversation.model.js';
import AdminMessage from '../../models/admin/AdminMessage.model.js';
import User from '../../models/user.model.js';

// Get list of conversations for current user
export const getConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const conversations = await AdminConversation.find({
            participants: userId
        })
        .populate('participants', 'name email avatar role')
        .sort({ updatedAt: -1 });
        
        res.status(200).json(conversations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get messages for a specific conversation
export const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const messages = await AdminMessage.find({ conversationId })
            .sort({ createdAt: 1 })
            .populate('senderId', 'name avatar');
        
        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Send a message
export const sendMessage = async (req, res) => {
    try {
        const { conversationId, text, attachments } = req.body;
        const senderId = req.user.id;
        const senderName = req.user.name;

        // If conversationId is provided, use it, else create new conversation
        let conversation;
        if (conversationId) {
            conversation = await AdminConversation.findById(conversationId);
        } else {
            const { participantId } = req.body;
            // Check if conversation already exists between these users
            conversation = await AdminConversation.findOne({
                participants: { $all: [senderId, participantId] },
                isGroup: false
            });

            if (!conversation) {
                conversation = new AdminConversation({
                    participants: [senderId, participantId]
                });
                await conversation.save();
            }
        }

        if (!conversation) return res.status(404).json({ message: "Conversation not found." });

        const newMessage = new AdminMessage({
            conversationId: conversation._id,
            senderId,
            senderName,
            text,
            attachments: attachments || []
        });

        await newMessage.save();

        // Update last message in conversation
        conversation.lastMessage = {
            text: text,
            senderId: senderId,
            createdAt: new Date()
        };
        await conversation.save();

        res.status(201).json(newMessage);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create a group conversation
export const createGroup = async (req, res) => {
    try {
        const { groupName, participantIds, projectId, groupType, department } = req.body;
        const senderId = req.user.id;

        if (!groupName || !participantIds) {
            return res.status(400).json({ message: "Group name and participants are required" });
        }

        const allParticipants = [...new Set([...participantIds, senderId])];

        const conversation = new AdminConversation({
            participants: allParticipants,
            isGroup: true,
            groupName: groupName,
            projectId: projectId,
            groupType: groupType || 'manual',
            department: department || 'General'
        });

        await conversation.save();
        
        // Populate participants info
        await AdminConversation.populate(conversation, {
            path: 'participants',
            select: 'name email avatar role'
        });

        res.status(201).json(conversation);
    } catch (error) {
        console.error('SERVER ERROR in createGroup:', error);
        res.status(500).json({ message: error.message });
    }
};

// Create or find a direct conversation
export const startConversation = async (req, res) => {
    try {
        const { participantId } = req.body;
        const senderId = req.user.id;

        let conversation = await AdminConversation.findOne({
            participants: { $all: [senderId, participantId] },
            isGroup: false
        }).populate('participants', 'name email avatar role');

        if (!conversation) {
            conversation = new AdminConversation({
                participants: [senderId, participantId]
            });
            await conversation.save();
            await conversation.populate('participants', 'name email avatar role');
        }

        res.status(200).json(conversation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

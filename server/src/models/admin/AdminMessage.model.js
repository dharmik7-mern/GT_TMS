import mongoose from 'mongoose';

const adminMessageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdminConversation',
        required: true,
        index: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    senderName: { type: String, required: true },
    senderAvatar: { type: String },
    text: { type: String, required: true },
    attachments: [{
        fileName: String,
        fileUrl: String,
        fileType: String,
        uploadedAt: { type: Date, default: Date.now }
    }],
    isRead: { type: Boolean, default: false }
}, { timestamps: true });

const AdminMessage = mongoose.model('AdminMessage', adminMessageSchema);
export default AdminMessage;

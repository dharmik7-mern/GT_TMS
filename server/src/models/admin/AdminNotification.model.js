import mongoose from 'mongoose';

const adminNotificationSchema = new mongoose.Schema({
    userId: { type: String, required: true }, // The user who should receive the notification
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['task', 'message', 'project', 'system'], default: 'task' },
    isRead: { type: Boolean, default: false },
    link: { type: String }, // Optional link to the relevant object
}, { timestamps: true });

export default mongoose.model("AdminNotification", adminNotificationSchema);

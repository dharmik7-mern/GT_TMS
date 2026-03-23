import mongoose from 'mongoose';

const uploadSchema = new mongoose.Schema({
    fileName: String,
    fileUrl: String,
    fileType: String,
    uploadedAt: { type: Date, default: Date.now }
});

const commentSchema = new mongoose.Schema({
    userId: String,
    userName: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
});

const adminTaskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    assignedUser: { type: String },
    participants: [{ type: String }],   // ← all participant names/IDs
    reminderAt: { type: Date },          // ← when to fire the reminder alert
    startDateTime: { type: Date },
    endDateTime: { type: Date },
    duration: { type: Number }, // In minutes
    color: { type: String, default: '#4DA3FF' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent', 'none'], default: 'none' },
    status: { type: String, enum: ['Pending', 'In Progress', 'Done'], default: 'Pending' },
    isRecurring: { type: Boolean, default: false },
    recurrenceRule: {
        frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'custom'] },
        interval: { type: Number, default: 1 },
        days: [Number], // 0-6 for weekly
        endAt: Date
    },
    tags: [{ type: String }],
    attachments: [uploadSchema],
    comments: [commentSchema]
}, { timestamps: true });

export default mongoose.model("AdminCalendarTask", adminTaskSchema);

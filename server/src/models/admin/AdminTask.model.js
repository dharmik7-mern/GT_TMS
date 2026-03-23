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
    startDateTime: { type: Date },
    endDateTime: { type: Date },
    priority: { type: String, enum: ['red', 'green', 'blue', 'yellow', 'none'], default: 'none' },
    status: { type: String, enum: ['Pending', 'In Progress', 'Done'], default: 'Pending' },
    tags: [{ type: String }],
    attachments: [uploadSchema],
    comments: [commentSchema]
}, { timestamps: true });

export default mongoose.model("AdminCalendarTask", adminTaskSchema);

import mongoose from 'mongoose';

const extensionRequestSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    taskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true }],
    reason: { type: String, required: true, trim: true, maxlength: 5000 },
    requestedDueDate: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    reviewerComment: { type: String, trim: true, maxlength: 5000 },
  },
  { timestamps: true }
);

extensionRequestSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    ret.userId = String(ret.userId);
    ret.taskIds = Array.isArray(ret.taskIds) ? ret.taskIds.map(id => String(id)) : [];
    ret.requestedDueDate = ret.requestedDueDate ? new Date(ret.requestedDueDate).toISOString().split('T')[0] : undefined;
    ret.reviewerId = ret.reviewerId ? String(ret.reviewerId) : undefined;
    ret.createdAt = ret.createdAt?.toISOString?.() || ret.createdAt;
    ret.updatedAt = ret.updatedAt?.toISOString?.() || ret.updatedAt;
    delete ret._id;
    delete ret.__v;
    delete ret.tenantId;
    return ret;
  },
});

export function getExtensionRequestModel(conn) {
  return conn.models.ExtensionRequest || conn.model('ExtensionRequest', extensionRequestSchema);
}

export { extensionRequestSchema };

import mongoose from 'mongoose';

const personalTaskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 10000 },
    status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo', index: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium', index: true },
    
    dueDate: { type: Date, default: null, index: true },
    dueTime: { type: String, default: null }, // HH:mm format
    
    labels: [{ type: String, trim: true, maxlength: 50 }],
    
    reminder: {
      enabled: { type: Boolean, default: false },
      at: { type: Date, default: null },
    },

    isPinned: { type: Boolean, default: false, index: true },
    completedAt: { type: Date, default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

personalTaskSchema.index({ userId: 1, status: 1 });
personalTaskSchema.index({ userId: 1, isPinned: 1 });

personalTaskSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    ret.userId = String(ret.userId);
    ret.tenantId = String(ret.tenantId);
    ret.createdAt = ret.createdAt?.toISOString?.() || ret.createdAt;
    ret.updatedAt = ret.updatedAt?.toISOString?.() || ret.updatedAt;
    ret.dueDate = ret.dueDate ? new Date(ret.dueDate).toISOString().split('T')[0] : undefined;
    ret.completedAt = ret.completedAt?.toISOString?.() || ret.completedAt;
    
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export function getPersonalTaskModel(conn) {
  return conn.models.PersonalTask || conn.model('PersonalTask', personalTaskSchema);
}

export { personalTaskSchema };

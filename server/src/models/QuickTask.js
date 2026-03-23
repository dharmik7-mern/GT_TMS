import mongoose from 'mongoose';

const quickTaskSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 10000 },
    status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo', index: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium', index: true },
    assigneeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dueDate: { type: Date, default: null, index: true },

    attachments: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        name: { type: String, required: true, trim: true, maxlength: 300 },
        url: { type: String, required: true, trim: true, maxlength: 2048 },
        size: { type: Number, required: true, min: 0 },
        type: { type: String, required: true, trim: true, maxlength: 150 },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    comments: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        content: { type: String, required: true, trim: true, maxlength: 8000 },
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    completionReview: {
      completedAt: { type: Date, default: null },
      completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      completionRemark: { type: String, trim: true, maxlength: 5000, default: '' },
      reviewStatus: { type: String, enum: ['pending', 'approved', 'changes_requested'], default: 'pending' },
      reviewRemark: { type: String, trim: true, maxlength: 5000, default: '' },
      reviewedAt: { type: Date, default: null },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
  },
  { timestamps: true }
);

quickTaskSchema.index({ workspaceId: 1, status: 1 });

quickTaskSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    ret.assigneeIds = Array.isArray(ret.assigneeIds) ? ret.assigneeIds.map((a) => String(a)) : [];
    ret.reporterId = String(ret.reporterId);
    ret.createdAt = ret.createdAt?.toISOString?.() || ret.createdAt;
    ret.updatedAt = ret.updatedAt?.toISOString?.() || ret.updatedAt;
    ret.dueDate = ret.dueDate ? new Date(ret.dueDate).toISOString().split('T')[0] : undefined;

    ret.attachments = Array.isArray(ret.attachments)
      ? ret.attachments.map((a) => ({
          id: String(a._id),
          name: a.name,
          url: a.url,
          size: a.size,
          type: a.type,
          uploadedBy: String(a.uploadedBy),
          createdAt: new Date(a.createdAt).toISOString(),
        }))
      : [];

    ret.comments = Array.isArray(ret.comments)
      ? ret.comments.map((c) => ({
          id: String(c._id),
          content: c.content,
          authorId: String(c.authorId),
          taskId: String(ret._id),
          createdAt: new Date(c.createdAt).toISOString(),
          updatedAt: new Date(c.updatedAt).toISOString(),
        }))
      : [];
    ret.completionReview = ret.completionReview
      ? {
          completedAt: ret.completionReview.completedAt ? new Date(ret.completionReview.completedAt).toISOString() : undefined,
          completedBy: ret.completionReview.completedBy ? String(ret.completionReview.completedBy) : undefined,
          completionRemark: ret.completionReview.completionRemark || '',
          reviewStatus: ret.completionReview.reviewStatus || 'pending',
          reviewRemark: ret.completionReview.reviewRemark || '',
          reviewedAt: ret.completionReview.reviewedAt ? new Date(ret.completionReview.reviewedAt).toISOString() : undefined,
          reviewedBy: ret.completionReview.reviewedBy ? String(ret.completionReview.reviewedBy) : undefined,
        }
      : {
          reviewStatus: 'pending',
          completionRemark: '',
          reviewRemark: '',
        };

    delete ret._id;
    delete ret.__v;
    delete ret.tenantId;
    delete ret.workspaceId;
    return ret;
  },
});

export function getQuickTaskModel(conn) {
  return conn.models.QuickTask || conn.model('QuickTask', quickTaskSchema);
}

export { quickTaskSchema };


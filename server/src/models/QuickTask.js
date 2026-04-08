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
    isPrivate: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    attachments: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        name: { type: String, required: true, trim: true, maxlength: 300 },
        url: { type: String, required: true, trim: true, maxlength: 2048 },
        storageProvider: { type: String, trim: true, maxlength: 40, default: 'local' },
        objectKey: { type: String, trim: true, maxlength: 1024, default: null },
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
      rating: { type: Number, min: 1, max: 5, default: null },
      reviewRemark: { type: String, trim: true, maxlength: 5000, default: '' },
      reviewedAt: { type: Date, default: null },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    labels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Label' }],
    tags: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

quickTaskSchema.index({ workspaceId: 1, status: 1 });

quickTaskSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    ret.reporterId = ret.reporterId ? String(ret.reporterId._id || ret.reporterId.id || ret.reporterId) : undefined;
    ret.assigneeIds = Array.isArray(ret.assigneeIds)
      ? ret.assigneeIds.map((a) => {
        if (!a) return undefined;
        const id = typeof a === 'object' ? (a._id || a.id || a) : a;
        return String(id);
      }).filter(Boolean)
      : [];
    ret.createdAt = ret.createdAt?.toISOString?.() || ret.createdAt;
    ret.updatedAt = ret.updatedAt?.toISOString?.() || ret.updatedAt;
    ret.dueDate = ret.dueDate ? new Date(ret.dueDate).toISOString().split('T')[0] : undefined;
    ret.isPrivate = !!ret.isPrivate;
    ret.createdBy = ret.createdBy ? String(ret.createdBy._id || ret.createdBy.id || ret.createdBy) : ret.reporterId;
    ret.assignedTo = ret.assignedTo ? String(ret.assignedTo._id || ret.assignedTo.id || ret.assignedTo) : (ret.assigneeIds?.[0] || undefined);

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
        rating: typeof ret.completionReview.rating === 'number' ? ret.completionReview.rating : undefined,
        reviewRemark: ret.completionReview.reviewRemark || '',
        reviewedAt: ret.completionReview.reviewedAt ? new Date(ret.completionReview.reviewedAt).toISOString() : undefined,
        reviewedBy: ret.completionReview.reviewedBy ? String(ret.completionReview.reviewedBy) : undefined,
      }
      : {
        reviewStatus: 'pending',
        rating: undefined,
        completionRemark: '',
        reviewRemark: '',
      };

    ret.labels = Array.isArray(ret.labels)
      ? ret.labels.map((v) => {
        if (!v) return undefined;
        const id = typeof v === 'object' ? (v._id || v.id || v) : v;
        return String(id);
      }).filter(Boolean)
      : [];
    ret.tags = Array.isArray(ret.tags) ? ret.tags.filter(t => typeof t === 'string' && t.trim()) : [];

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


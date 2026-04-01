import mongoose from 'mongoose';

const requestStatuses = ['pending', 'approved', 'rejected'];

const taskCreationRequestSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 10000, default: '' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    status: { type: String, enum: ['backlog', 'todo', 'scheduled', 'in_progress', 'in_review', 'blocked', 'done'], default: 'todo' },
    assigneeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestedToIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }],
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    durationDays: { type: Number, required: true, min: 1, max: 3650 },
    phaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Phase', default: null, index: true },
    subcategoryId: { type: String, trim: true, maxlength: 100, default: null },
    estimatedHours: { type: Number, default: null, min: 0 },
    order: { type: Number, default: 0 },
    labels: [{ type: String, trim: true, maxlength: 40 }],
    subtasks: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        title: { type: String, required: true, trim: true, maxlength: 300 },
        isCompleted: { type: Boolean, default: false },
        order: { type: Number, default: 0 },
      },
    ],
    requestStatus: { type: String, enum: requestStatuses, default: 'pending', index: true },
    reviewNote: { type: String, trim: true, maxlength: 5000, default: '' },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  },
  { timestamps: true }
);

taskCreationRequestSchema.index({ tenantId: 1, workspaceId: 1, projectId: 1, requestStatus: 1, createdAt: -1 });

taskCreationRequestSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    ret.projectId = String(ret.projectId);
    ret.assigneeIds = Array.isArray(ret.assigneeIds) ? ret.assigneeIds.map((value) => String(value)) : [];
    ret.requestedBy = String(ret.requestedBy);
    ret.requestedToIds = Array.isArray(ret.requestedToIds) ? ret.requestedToIds.map((value) => String(value)) : [];
    ret.phaseId = ret.phaseId ? String(ret.phaseId) : undefined;
    ret.subcategoryId = ret.subcategoryId || undefined;
    ret.createdTaskId = ret.createdTaskId ? String(ret.createdTaskId) : undefined;
    ret.startDate = ret.startDate ? new Date(ret.startDate).toISOString().split('T')[0] : undefined;
    ret.dueDate = ret.dueDate ? new Date(ret.dueDate).toISOString().split('T')[0] : undefined;
    ret.reviewedBy = ret.reviewedBy ? String(ret.reviewedBy) : undefined;
    ret.reviewedAt = ret.reviewedAt?.toISOString?.() || ret.reviewedAt;
    ret.createdAt = ret.createdAt?.toISOString?.() || ret.createdAt;
    ret.updatedAt = ret.updatedAt?.toISOString?.() || ret.updatedAt;
    ret.subtasks = Array.isArray(ret.subtasks)
      ? ret.subtasks.map((subtask) => ({
          id: String(subtask._id),
          title: subtask.title,
          isCompleted: Boolean(subtask.isCompleted),
          order: subtask.order ?? 0,
        }))
      : [];
    delete ret._id;
    delete ret.__v;
    delete ret.tenantId;
    delete ret.workspaceId;
    return ret;
  },
});

export function getTaskCreationRequestModel(conn) {
  return conn.models.TaskCreationRequest || conn.model('TaskCreationRequest', taskCreationRequestSchema);
}

export { taskCreationRequestSchema, requestStatuses };

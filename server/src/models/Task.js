import mongoose from 'mongoose';

const subtaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    isCompleted: { type: Boolean, default: false },
    assigneeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    order: { type: Number, default: 0 },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: true, timestamps: true }
);

const taskStatuses = ['backlog', 'todo', 'scheduled', 'in_progress', 'in_review', 'done'];
const taskTypes = ['operational', 'design', 'important'];
const reviewStatuses = ['pending', 'approved', 'changes_requested'];
const timelineItemTypes = ['task', 'milestone'];

const taskSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 10000 },
    status: { type: String, enum: taskStatuses, default: 'todo', index: true },
    taskType: { type: String, enum: taskTypes, default: 'operational', index: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium', index: true },

    assigneeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    parentTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    phaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Phase', default: null, index: true },
    subcategoryId: { type: String, trim: true, maxlength: 100, default: null },
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true }],
    timelineType: { type: String, enum: timelineItemTypes, default: 'task', index: true },
    subtasks: [subtaskSchema],
    tags: [{ type: String, trim: true, index: true }],
    labels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Label', index: true }],
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null, index: true },
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
    duration: { type: Number, default: null }, // in minutes
    color: { type: String, trim: true, maxlength: 32 },
    isRecurring: { type: Boolean, default: false },
    recurrenceRule: { type: Object, default: null }, // { frequency: 'daily' | 'weekly' | 'monthly', interval: number }
    estimatedHours: { type: Number, default: null, min: 0 },
    trackedHours: { type: Number, default: null, min: 0 },
    order: { type: Number, default: 0, index: true },

    comments: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        content: { type: String, required: true, trim: true, maxlength: 8000 },
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
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
    completionReview: {
      completedAt: { type: Date, default: null },
      completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      completionRemark: { type: String, trim: true, maxlength: 5000, default: '' },
      reviewStatus: { type: String, enum: reviewStatuses, default: 'pending' },
      rating: { type: Number, min: 1, max: 5, default: null },
      reviewRemark: { type: String, trim: true, maxlength: 5000, default: '' },
      reviewedAt: { type: Date, default: null },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    isReassignPending: { type: Boolean, default: false, index: true },
    requestedAssigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reassignRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

taskSchema.index({ projectId: 1, status: 1, order: 1 });
taskSchema.index({ projectId: 1, assigneeIds: 1 });

function mapSubtasks(subs) {
  if (!Array.isArray(subs)) return [];
  return subs.map((s) => {
    const assigneeObj = s.assigneeId && typeof s.assigneeId === 'object' && s.assigneeId._id ? s.assigneeId : null;
    const assignee = assigneeObj
      ? {
        id: String(assigneeObj._id),
        name: assigneeObj.name,
        avatar: assigneeObj.avatar,
        color: assigneeObj.color,
      }
      : undefined;
    return {
      id: String(s._id),
      title: s.title,
      isCompleted: Boolean(s.isCompleted),
      order: s.order ?? 0,
      assigneeId: s.assigneeId ? String(s.assigneeId) : undefined,
      assignee,
      createdAt: s.createdAt?.toISOString?.() || undefined,
      updatedAt: s.updatedAt?.toISOString?.() || undefined,
    };
  });
}

function subtaskProgress(subs) {
  const list = Array.isArray(subs) ? subs : [];
  const total = list.length;
  const completed = list.filter((s) => s.isCompleted).length;
  return { completed, total };
}

taskSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    ret.projectId = String(ret.projectId);
    ret.assigneeIds = Array.isArray(ret.assigneeIds)
      ? ret.assigneeIds.map((a) => {
          if (!a) return undefined;
          const id = typeof a === 'object' && a._id ? a._id : a;
          return String(id);
        }).filter(Boolean)
      : [];
    ret.reporterId = ret.reporterId ? String(ret.reporterId._id || ret.reporterId) : undefined;
    ret.parentTaskId = ret.parentTaskId ? String(ret.parentTaskId) : undefined;
    ret.phaseId = ret.phaseId ? String(ret.phaseId) : undefined;
    ret.subcategoryId = ret.subcategoryId || undefined;
    ret.dependencies = Array.isArray(ret.dependencies) ? ret.dependencies.map((value) => String(value)) : [];
    ret.labels = Array.isArray(ret.labels)
      ? ret.labels.map((v) => {
          if (!v) return undefined;
          const id = typeof v === 'object' ? (v._id || v.id || v) : v;
          return String(id);
        }).filter(Boolean)
      : [];
    const rawSubs = Array.isArray(_doc.subtasks) ? _doc.subtasks : [];
    ret.subtasks = mapSubtasks(rawSubs);
    const sp = subtaskProgress(rawSubs);
    ret.subtaskCompleted = sp.completed;
    ret.subtaskTotal = sp.total;
    ret.createdAt = ret.createdAt?.toISOString?.() || ret.createdAt;
    ret.updatedAt = ret.updatedAt?.toISOString?.() || ret.updatedAt;
    ret.startDate = ret.startDate ? new Date(ret.startDate).toISOString().split('T')[0] : undefined;
    ret.dueDate = ret.dueDate ? new Date(ret.dueDate).toISOString().split('T')[0] : undefined;
    ret.endDate = ret.dueDate;
    ret.type = ret.timelineType || 'task';
    ret.startTime = ret.startTime?.toISOString?.() || ret.startTime;
    ret.endTime = ret.endTime?.toISOString?.() || ret.endTime;
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
    ret.isReassignPending = !!ret.isReassignPending;
    ret.requestedAssigneeId = ret.requestedAssigneeId ? String(ret.requestedAssigneeId) : undefined;
    ret.reassignRequestedBy = ret.reassignRequestedBy ? String(ret.reassignRequestedBy) : undefined;
    delete ret._id;
    delete ret.__v;
    delete ret.tenantId;
    delete ret.workspaceId;
    return ret;
  },
});

export function getTaskModel(conn) {
  return conn.models.Task || conn.model('Task', taskSchema);
}

export { taskSchema, taskStatuses, taskTypes, timelineItemTypes };

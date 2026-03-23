import mongoose from 'mongoose';

const subtaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    isCompleted: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: true, timestamps: true }
);

const taskStatuses = ['backlog', 'todo', 'scheduled', 'in_progress', 'in_review', 'blocked', 'done'];
const taskTypes = ['operational', 'design', 'important'];

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
    subtasks: [subtaskSchema],
    labels: [{ type: String, trim: true, maxlength: 40 }],
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
        size: { type: Number, required: true, min: 0 },
        type: { type: String, required: true, trim: true, maxlength: 150 },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

taskSchema.index({ projectId: 1, status: 1, order: 1 });
taskSchema.index({ projectId: 1, assigneeIds: 1 });

function mapSubtasks(subs) {
  if (!Array.isArray(subs)) return [];
  return subs.map((s) => ({
    id: String(s._id),
    title: s.title,
    isCompleted: Boolean(s.isCompleted),
    order: s.order ?? 0,
    createdAt: s.createdAt?.toISOString?.() || undefined,
    updatedAt: s.updatedAt?.toISOString?.() || undefined,
  }));
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
    ret.assigneeIds = Array.isArray(ret.assigneeIds) ? ret.assigneeIds.map((a) => String(a)) : [];
    ret.reporterId = String(ret.reporterId);
    ret.parentTaskId = ret.parentTaskId ? String(ret.parentTaskId) : undefined;
    const rawSubs = Array.isArray(_doc.subtasks) ? _doc.subtasks : [];
    ret.subtasks = mapSubtasks(rawSubs);
    const sp = subtaskProgress(rawSubs);
    ret.subtaskCompleted = sp.completed;
    ret.subtaskTotal = sp.total;
    ret.createdAt = ret.createdAt?.toISOString?.() || ret.createdAt;
    ret.updatedAt = ret.updatedAt?.toISOString?.() || ret.updatedAt;
    ret.startDate = ret.startDate ? new Date(ret.startDate).toISOString().split('T')[0] : undefined;
    ret.dueDate = ret.dueDate ? new Date(ret.dueDate).toISOString().split('T')[0] : undefined;
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

export { taskSchema, taskStatuses, taskTypes };

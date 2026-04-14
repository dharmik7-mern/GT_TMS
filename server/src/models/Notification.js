import mongoose from 'mongoose';

const notificationTypes = [
  'task_assigned',
  'comment_added',
  'deadline_approaching',
  'quick_task_deadline_approaching',
  'project_update',
  'mention',
  'broadcast',
  'task_created',
  'task_updated',
  'task_status_changed',
  'task_assignees_changed',
  'task_deleted',
  'task_creation_request',
  'task_request_approved',
  'task_request_rejected',
  'task_reassign_requested',
  'task_reassigned',
  'quick_task_created',
  'quick_task_updated',
  'quick_task_status_changed',
  'quick_task_priority_changed',
  'quick_task_due_date_changed',
  'quick_task_completion_remark_updated',
  'quick_task_assignees_changed',
  'quick_task_deleted',
  'quick_task_comment_added',
  'quick_task_attachments_added',
  'daily_work_report_generated',
  'task_overdue',
  'extension_request_created',
  'extension_request_approved',
  'extension_request_rejected',
];

const notificationSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: notificationTypes, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    isRead: { type: Boolean, default: false, index: true },
    relatedId: { type: String, default: null },
    audienceType: { type: String, enum: ['all', 'company', 'user'], default: 'user' },
    audienceLabel: { type: String, trim: true, maxlength: 200, default: '' },
    broadcastId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

notificationSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    ret.userId = String(ret.userId);
    ret.createdAt = ret.createdAt?.toISOString?.() || ret.createdAt;
    delete ret._id;
    delete ret.__v;
    delete ret.tenantId;
    delete ret.workspaceId;
    return ret;
  },
});

export function getNotificationModel(conn) {
  return conn.models.Notification || conn.model('Notification', notificationSchema);
}

export { notificationSchema };


import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    entityType: { type: String, required: true, trim: true, maxlength: 60 },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    metadata: { type: Object, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ workspaceId: 1, createdAt: -1 });
activityLogSchema.index({ entityType: 1, entityId: 1 });
activityLogSchema.index({ tenantId: 1, workspaceId: 1, createdAt: -1 });
activityLogSchema.index({ tenantId: 1, workspaceId: 1, userId: 1, createdAt: -1 });
activityLogSchema.index({ tenantId: 1, workspaceId: 1, entityType: 1, entityId: 1, createdAt: -1 });

activityLogSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    ret.userId = String(ret.userId);
    ret.entityId = String(ret.entityId);
    ret.createdAt = ret.createdAt?.toISOString?.() || ret.createdAt;
    delete ret._id;
    delete ret.__v;
    delete ret.tenantId;
    delete ret.workspaceId;
    return ret;
  },
});

export function getActivityLogModel(conn) {
  return conn.models.ActivityLog || conn.model('ActivityLog', activityLogSchema);
}

export { activityLogSchema };


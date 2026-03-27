import mongoose from 'mongoose';

const taskReassignRequestSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    currentAssigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestedAssigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionNote: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

taskReassignRequestSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    ret.taskId = String(ret.taskId);
    ret.requestedBy = String(ret.requestedBy);
    ret.currentAssigneeId = String(ret.currentAssigneeId);
    ret.requestedAssigneeId = String(ret.requestedAssigneeId);
    ret.approvedBy = ret.approvedBy ? String(ret.approvedBy) : undefined;
    delete ret._id;
    delete ret.__v;
    delete ret.tenantId;
    return ret;
  },
});

export function getTaskReassignRequestModel(conn) {
  return conn.models.TaskReassignRequest || conn.model('TaskReassignRequest', taskReassignRequestSchema);
}

export { taskReassignRequestSchema };

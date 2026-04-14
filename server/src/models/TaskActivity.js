import mongoose from 'mongoose';

const taskActivitySchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    action: {
      type: String,
      enum: [
        'CREATED',
        'ASSIGNED',
        'ASSIGNEE_CHANGED',
        'STATUS_CHANGED',
        'PRIORITY_CHANGED',
        'COMMENT_ADDED',
        'ATTACHMENT_ADDED',
        'SUBTASK_ADDED',
        'DEACTIVATED',
      ],
      required: true,
    },
    oldValue: { type: String, default: null },
    newValue: { type: String, default: null },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

// Helper for dynamic multi-tenancy
const modelCache = new Map();

export const getTaskActivityModel = (tenantId) => {
  const dbName = `company_${tenantId}`;
  const cacheKey = `${dbName}_TaskActivity`;
  if (modelCache.has(cacheKey)) return modelCache.get(cacheKey);

  const db = mongoose.connection.useDb(dbName, { useCache: true });
  const model = db.model('TaskActivity', taskActivitySchema);
  modelCache.set(cacheKey, model);
  return model;
};

export default taskActivitySchema;

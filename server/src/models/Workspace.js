import mongoose from 'mongoose';

const permissionMatrixSchema = new mongoose.Schema({}, { strict: false, _id: false });

const workspaceSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'pro' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    logo: { type: String, trim: true, maxlength: 2048 },
    settings: {
      defaultLanguage: { type: String, default: 'English (US)' },
      timezone: { type: String, default: 'UTC+0 (GMT)' },
      dateFormat: { type: String, default: 'MM/DD/YYYY' },
      weekStartsOn: { type: String, default: 'Monday' },
      employeeIdConfig: {
        prefix: { type: String, default: 'EMP' },
        separator: { type: String, default: '-' },
        digits: { type: Number, default: 4 },
        nextSequence: { type: Number, default: 1 },
      },
      security: {
        strongPasswords: { type: Boolean, default: true },
      },
      permissions: { type: permissionMatrixSchema, default: {} },
    },
  },
  { timestamps: true }
);

workspaceSchema.index({ tenantId: 1, slug: 1 }, { unique: true });

workspaceSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export function getWorkspaceModel(conn) {
  return conn.models.Workspace || conn.model('Workspace', workspaceSchema);
}

export { workspaceSchema };


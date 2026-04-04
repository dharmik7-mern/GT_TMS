import mongoose from 'mongoose';

const labelSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    color: { type: String, required: true, trim: true, maxlength: 7, default: '#71717a' },
  },
  { timestamps: true }
);

labelSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

labelSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export function getLabelModel(conn) {
  return conn.models.Label || conn.model('Label', labelSchema);
}

export { labelSchema };
export const Label = mongoose.models.Label || mongoose.model('Label', labelSchema);

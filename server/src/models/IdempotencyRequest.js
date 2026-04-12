import mongoose from 'mongoose';

const idempotencyRequestSchema = new mongoose.Schema(
  {
    scopeKey: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    workspaceId: { type: String, default: '', index: true },
    userId: { type: String, required: true, index: true },
    method: { type: String, required: true, maxlength: 10 },
    routeKey: { type: String, required: true, maxlength: 500 },
    idempotencyKey: { type: String, required: true, maxlength: 200 },
    requestHash: { type: String, required: true, maxlength: 128 },
    status: { type: String, enum: ['started', 'completed', 'failed'], default: 'started', index: true },
    statusCode: { type: Number, default: null },
    responseBody: { type: mongoose.Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

idempotencyRequestSchema.index({ scopeKey: 1 }, { unique: true });
idempotencyRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.IdempotencyRequest || mongoose.model('IdempotencyRequest', idempotencyRequestSchema);

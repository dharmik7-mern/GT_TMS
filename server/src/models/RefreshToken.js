import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    revokedAt: { type: Date, default: null },
    rotatedFromHash: { type: String, default: null },
    expiresAt: { type: Date, required: true, index: true },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: true }
);

refreshTokenSchema.index({ userId: 1, revokedAt: 1 });

export function getRefreshTokenModel(conn) {
  return conn.models.RefreshToken || conn.model('RefreshToken', refreshTokenSchema);
}

export { refreshTokenSchema };


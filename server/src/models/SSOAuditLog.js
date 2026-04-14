import mongoose from 'mongoose';

const ssoAuditLogSchema = new mongoose.Schema(
  {
    event: { type: String, required: true, trim: true, maxlength: 80 },
    outcome: { type: String, enum: ['success', 'failure'], required: true },
    reason: { type: String, trim: true, maxlength: 120, default: null },
    message: { type: String, trim: true, maxlength: 500, default: null },
    issuer: { type: String, trim: true, maxlength: 200, default: null },
    audience: { type: String, trim: true, maxlength: 200, default: null },
    subject: { type: String, trim: true, maxlength: 200, default: null },
    email: { type: String, trim: true, lowercase: true, maxlength: 200, default: null },
    employeeId: { type: String, trim: true, maxlength: 120, default: null },
    tenantId: { type: String, trim: true, maxlength: 120, default: null },
    workspaceId: { type: String, trim: true, maxlength: 120, default: null },
    userId: { type: String, trim: true, maxlength: 120, default: null },
    autoProvisioned: { type: Boolean, default: false },
    ip: { type: String, trim: true, maxlength: 120, default: null },
    userAgent: { type: String, trim: true, maxlength: 500, default: null },
    origin: { type: String, trim: true, maxlength: 300, default: null },
    referer: { type: String, trim: true, maxlength: 500, default: null },
    metadata: { type: Object, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ssoAuditLogSchema.index({ event: 1, createdAt: -1 });
ssoAuditLogSchema.index({ outcome: 1, reason: 1, createdAt: -1 });
ssoAuditLogSchema.index({ tenantId: 1, workspaceId: 1, createdAt: -1 });

const SSOAuditLog = mongoose.models.SSOAuditLog || mongoose.model('SSOAuditLog', ssoAuditLogSchema);
export default SSOAuditLog;

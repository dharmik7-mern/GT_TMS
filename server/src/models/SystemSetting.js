import mongoose from 'mongoose';

const systemSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    general: {
      siteName: { type: String, default: 'Gitakshmi PMS' },
      supportEmail: { type: String, default: 'gitakshmi@support.com' },
      adminEmail: { type: String, default: 'admin@gmail.com' },
      siteLanguage: { type: String, default: 'English' },
      timeZone: { type: String, default: 'UTC+0 (GMT)' },
    },
    security: {
      openRegistration: { type: Boolean, default: true },
      confirmEmail: { type: Boolean, default: true },
      extraLoginSecurity: { type: Boolean, default: false },
      strongPasswords: { type: Boolean, default: true },
    },
    email: {
      smtpHost: { type: String, default: 'smtp.sendgrid.net' },
      smtpPort: { type: Number, default: 587 },
      securityType: { type: String, default: 'TLS' },
      username: { type: String, default: 'apikey' },
      password: { type: String, default: '' },
      templates: {
        welcomeMessage: { type: Boolean, default: true },
        forgotPassword: { type: Boolean, default: true },
        loginAlert: { type: Boolean, default: true },
        paymentReceipt: { type: Boolean, default: true },
      },
    },
    infrastructure: {
      maintenanceMode: { type: Boolean, default: false },
      lastBackupAt: { type: Date, default: null },
      storageLimitMb: { type: Number, default: 512000 },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

systemSettingSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    ret.updatedBy = ret.updatedBy ? String(ret.updatedBy) : null;
    ret.infrastructure = {
      ...ret.infrastructure,
      lastBackupAt: ret.infrastructure?.lastBackupAt?.toISOString?.() || ret.infrastructure?.lastBackupAt || null,
    };
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const SystemSetting = mongoose.models.SystemSetting || mongoose.model('SystemSetting', systemSettingSchema);
export default SystemSetting;

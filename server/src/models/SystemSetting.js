import mongoose from 'mongoose';

function defaultEmailTemplates() {
  return {
    welcomeMessage: {
      enabled: true,
      subject: 'Welcome to {{siteName}}',
      body: 'Hi {{userName}},\n\nWelcome to {{siteName}}.\n\nYou can sign in here: {{loginUrl}}\n\nRegards,\n{{siteName}}',
    },
    forgotPassword: {
      enabled: true,
      subject: 'Reset your {{siteName}} password',
      body: 'Hi {{userName}},\n\nWe received a request to reset your password.\n\nUse this link: {{resetUrl}}\n\nIf you did not request this, you can ignore this email.\n\nRegards,\n{{siteName}}',
    },
    loginAlert: {
      enabled: true,
      subject: 'New sign-in to your {{siteName}} account',
      body: 'Hi {{userName}},\n\nYour account was accessed on {{loginTime}}.\n\nIf this was not you, contact the administrator immediately.\n\nRegards,\n{{siteName}}',
    },
    paymentReceipt: {
      enabled: true,
      subject: 'Payment receipt from {{siteName}}',
      body: 'Hi {{userName}},\n\nWe received your payment of {{amount}}.\n\nReceipt ID: {{receiptId}}\n\nRegards,\n{{siteName}}',
    },
    taskAssigned: {
      enabled: true,
      subject: 'New task assigned: {{taskTitle}}',
      body: 'Hi {{userName}},\n\nA task has been assigned to you.\n\nTask: {{taskTitle}}\nProject: {{projectName}}\nPriority: {{priority}}\nDue date: {{dueDate}}\nAssigned by: {{assignedBy}}\n\nOpen task: {{taskUrl}}\n\nRegards,\n{{siteName}}',
    },
    quickTaskAssigned: {
      enabled: true,
      subject: 'New quick task assigned: {{taskTitle}}',
      body: 'Hi {{userName}},\n\nA quick task has been assigned to you.\n\nTask: {{taskTitle}}\nPriority: {{priority}}\nDue date: {{dueDate}}\nAssigned by: {{assignedBy}}\n\nOpen task: {{taskUrl}}\n\nRegards,\n{{siteName}}',
    },
    userCredentials: {
      enabled: true,
      subject: 'Your {{siteName}} account credentials',
      body: 'Hi {{userName}},\n\nAn account has been created for you.\n\nUsername: {{email}}\nPassword: {{password}}\nRole: {{role}}\n\nSign in here: {{loginUrl}}\n\nPlease change your password after logging in.\n\nRegards,\n{{siteName}}',
    },
  };
}

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
      strongPasswords: { type: Boolean, default: false },
    },
    email: {
      smtpHost: { type: String, default: 'smtp.sendgrid.net' },
      smtpPort: { type: Number, default: 587 },
      securityType: { type: String, default: 'TLS' },
      username: { type: String, default: 'apikey' },
      password: { type: String, default: '' },
      templates: {
        type: mongoose.Schema.Types.Mixed,
        default: defaultEmailTemplates,
      },
    },
    infrastructure: {
      maintenanceMode: { type: Boolean, default: false },
      lastBackupAt: { type: Date, default: null },
      storageLimitMb: { type: Number, default: 512000 },
    },
    idGeneration: {
      company: {
        prefix: { type: String, default: 'ORG' },
        separator: { type: String, default: '-' },
        digits: { type: Number, default: 4 },
        nextSequence: { type: Number, default: 1 },
      },
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

import nodemailer from 'nodemailer';
import SystemSetting from '../models/SystemSetting.js';

const DEFAULT_TEMPLATE_MAP = {
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

function normalizeSecurityType(value) {
  return String(value || 'TLS').trim().toUpperCase();
}

function normalizeEmailTemplate(rawTemplate, fallback) {
  if (typeof rawTemplate === 'boolean') {
    return { ...fallback, enabled: rawTemplate };
  }

  return {
    enabled: rawTemplate?.enabled !== undefined ? Boolean(rawTemplate.enabled) : fallback.enabled,
    subject: String(rawTemplate?.subject ?? fallback.subject ?? '').trim(),
    body: String(rawTemplate?.body ?? fallback.body ?? ''),
  };
}

function normalizeEmailSettings(rawSettings = {}, generalSettings = {}) {
  const templates = Object.fromEntries(
    Object.entries(DEFAULT_TEMPLATE_MAP).map(([key, fallback]) => [
      key,
      normalizeEmailTemplate(rawSettings?.templates?.[key], fallback),
    ])
  );

  return {
    smtpHost: String(rawSettings?.smtpHost || '').trim(),
    smtpPort: Number(rawSettings?.smtpPort || 0) || 0,
    securityType: normalizeSecurityType(rawSettings?.securityType),
    username: String(rawSettings?.username || '').trim(),
    password: String(rawSettings?.password || ''),
    templates,
    siteName: String(generalSettings?.siteName || 'Gitakshmi PMS').trim() || 'Gitakshmi PMS',
    supportEmail: String(generalSettings?.supportEmail || rawSettings?.username || '').trim(),
    adminEmail: String(generalSettings?.adminEmail || '').trim(),
  };
}

function buildTransportConfig(emailSettings) {
  const securityType = normalizeSecurityType(emailSettings.securityType);
  const secure = securityType === 'SSL';

  return {
    host: emailSettings.smtpHost,
    port: Number(emailSettings.smtpPort || (secure ? 465 : 587)),
    secure,
    auth: emailSettings.username
      ? {
          user: emailSettings.username,
          pass: emailSettings.password,
        }
      : undefined,
  };
}

function renderTemplate(template, variables) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = variables?.[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function toHtml(body) {
  const content = String(body || '').trim();
  if (!content) return '';
  if (/[<>]/.test(content)) return content;
  return content.replace(/\n/g, '<br />');
}

function resolveAppUrl() {
  return (
    String(process.env.APP_URL || '').trim() ||
    String(process.env.CLIENT_URL || '').trim() ||
    'http://localhost:5173'
  );
}

async function loadSystemMailSettings() {
  const settings = await SystemSetting.findOne({ key: 'system' }).lean();
  return normalizeEmailSettings(settings?.email || {}, settings?.general || {});
}

export async function getMailSettings() {
  return loadSystemMailSettings();
}

export async function createMailTransport(overrideSettings = null) {
  const emailSettings = overrideSettings || await loadSystemMailSettings();
  if (!emailSettings.smtpHost || !emailSettings.smtpPort || !emailSettings.username) {
    const err = new Error('SMTP host, port, and username are required before sending emails');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }
  return nodemailer.createTransport(buildTransportConfig(emailSettings));
}

export async function sendMail({ to, subject, html, text, from, settingsOverride = null }) {
  const emailSettings = settingsOverride || await loadSystemMailSettings();
  const transporter = await createMailTransport(emailSettings);
  const fromAddress = from || emailSettings.supportEmail || emailSettings.username;
  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
    text,
  });

  return info;
}

export async function sendTemplatedEmail({ to, templateKey, variables = {}, settingsOverride = null }) {
  const emailSettings = settingsOverride || await loadSystemMailSettings();
  const template = emailSettings.templates?.[templateKey];
  if (!template?.enabled) {
    return { skipped: true, reason: 'template_disabled' };
  }

  const mergedVariables = {
    appUrl: resolveAppUrl(),
    loginUrl: `${resolveAppUrl().replace(/\/$/, '')}/login`,
    siteName: emailSettings.siteName,
    supportEmail: emailSettings.supportEmail || emailSettings.username,
    adminEmail: emailSettings.adminEmail,
    ...variables,
  };

  const subject = renderTemplate(template.subject, mergedVariables);
  const body = renderTemplate(template.body, mergedVariables);
  return sendMail({
    to,
    subject,
    html: toHtml(body),
    text: body,
    settingsOverride: emailSettings,
  });
}

export async function sendTemplatedEmailSafe(options) {
  try {
    return await sendTemplatedEmail(options);
  } catch (error) {
    console.error('EMAIL_SEND_FAILED', {
      templateKey: options?.templateKey,
      to: options?.to,
      message: error?.message,
    });
    return { skipped: true, reason: error?.code || 'send_failed' };
  }
}

export async function verifyMailSettings(emailSettingsOverride = null) {
  const emailSettings = emailSettingsOverride || await loadSystemMailSettings();
  const transporter = await createMailTransport(emailSettings);
  await transporter.verify();
  return {
    ok: true,
    message: 'SMTP connection verified successfully.',
  };
}

export { DEFAULT_TEMPLATE_MAP, normalizeEmailSettings };

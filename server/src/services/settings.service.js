import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import SystemSetting from '../models/SystemSetting.js';
import Company from '../models/Company.js';
import { getTenantModels } from '../config/tenantDb.js';
import { DEFAULT_TEMPLATE_MAP, normalizeEmailSettings, verifyMailSettings } from './mail.service.js';

const SETTINGS_KEY = 'system';
const DEFAULT_SECURITY_SETTINGS = {
  openRegistration: true,
  confirmEmail: true,
  extraLoginSecurity: false,
  strongPasswords: false,
};
const DEFAULT_COMPANY_ID_CONFIG = {
  prefix: 'ORG',
  separator: '-',
  digits: 4,
  nextSequence: 1,
};
const DEFAULT_EMAIL_SETTINGS = normalizeEmailSettings({}, {
  siteName: 'Gitakshmi PMS',
  supportEmail: 'gitakshmi@support.com',
  adminEmail: 'admin@gmail.com',
});

function normalizeIdConfig(config, fallback = DEFAULT_COMPANY_ID_CONFIG) {
  return {
    prefix: String(config?.prefix ?? fallback.prefix ?? '').trim().slice(0, 20),
    separator: String(config?.separator ?? fallback.separator ?? '').slice(0, 3),
    digits: Math.max(1, Math.min(8, Number(config?.digits ?? fallback.digits ?? 4) || 4)),
    nextSequence: Math.max(1, Number(config?.nextSequence ?? fallback.nextSequence ?? 1) || 1),
  };
}

export function formatGeneratedId(config, sequence) {
  const normalized = normalizeIdConfig(config);
  const padded = String(sequence).padStart(normalized.digits, '0');
  return `${normalized.prefix}${normalized.separator}${padded}`;
}

function deepMerge(target, source) {
  const output = { ...target };
  for (const [key, value] of Object.entries(source || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = deepMerge(output[key] || {}, value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

async function ensureSystemSettings() {
  let item = await SystemSetting.findOne({ key: SETTINGS_KEY });
  if (!item) {
    item = await SystemSetting.create({ key: SETTINGS_KEY });
  }
  return item;
}

function getNormalizedEmailSettingsFromDoc(settingsDoc) {
  return normalizeEmailSettings(
    settingsDoc?.email?.toObject?.() || settingsDoc?.email || {},
    settingsDoc?.general?.toObject?.() || settingsDoc?.general || {}
  );
}

function getSecuritySettingsFromDoc(settingsDoc) {
  return {
    ...DEFAULT_SECURITY_SETTINGS,
    ...(settingsDoc?.security?.toObject?.() || settingsDoc?.security || {}),
  };
}

function formatRelativeTime(fromDate) {
  if (!fromDate) return 'Never';
  const diffMs = Date.now() - new Date(fromDate).getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function getUploadsDirectorySizeMb() {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) return 0;

  let totalBytes = 0;
  const stack = [uploadsDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else {
        totalBytes += fs.statSync(fullPath).size;
      }
    }
  }
  return Math.round(totalBytes / (1024 * 1024));
}

async function buildSystemStats(settings) {
  const companies = await Company.find().select('_id');
  const companyStats = await Promise.all(
    companies.map(async (company) => {
      const { User } = await getTenantModels(company._id);
      const [usersCount, onlineUsers] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
      ]);
      return { usersCount, onlineUsers };
    })
  );

  const companiesCount = companies.length;
  const usersCount = companyStats.reduce((sum, item) => sum + item.usersCount, 0);
  const onlineUsers = companyStats.reduce((sum, item) => sum + item.onlineUsers, 0);

  const storageUsedMb = getUploadsDirectorySizeMb();
  const storageLimitMb = settings.infrastructure?.storageLimitMb || 512000;

  return {
    lastBackupAt: settings.infrastructure?.lastBackupAt || null,
    lastBackupText: formatRelativeTime(settings.infrastructure?.lastBackupAt),
    storageUsedMb,
    storageLimitMb,
    storageUsedText: `${storageUsedMb}MB / ${Math.round(storageLimitMb / 1024)}GB`,
    onlineUsers,
    companiesCount,
    usersCount,
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    maintenanceMode: Boolean(settings.infrastructure?.maintenanceMode),
  };
}

export async function getSystemSettings() {
  const settings = await ensureSystemSettings();
  const stats = await buildSystemStats(settings.toJSON());
  const normalizedEmail = getNormalizedEmailSettingsFromDoc(settings);
  return {
    ...settings.toJSON(),
    email: normalizedEmail,
    idGeneration: {
      company: normalizeIdConfig(settings.idGeneration?.company, DEFAULT_COMPANY_ID_CONFIG),
    },
    stats,
  };
}

export async function updateSystemSettings({ updates, userId }) {
  const current = await ensureSystemSettings();
  const currentEmail = getNormalizedEmailSettingsFromDoc(current);
  const merged = {
    general: deepMerge(current.general?.toObject?.() || current.general || {}, updates.general || {}),
    security: deepMerge(current.security?.toObject?.() || current.security || {}, updates.security || {}),
    email: normalizeEmailSettings(
      deepMerge(currentEmail, updates.email || {}),
      deepMerge(current.general?.toObject?.() || current.general || {}, updates.general || {})
    ),
    infrastructure: deepMerge(current.infrastructure?.toObject?.() || current.infrastructure || {}, updates.infrastructure || {}),
    idGeneration: {
      company: normalizeIdConfig(
        deepMerge(current.idGeneration?.company?.toObject?.() || current.idGeneration?.company || {}, updates.idGeneration?.company || {}),
        DEFAULT_COMPANY_ID_CONFIG
      ),
    },
  };

  current.general = merged.general;
  current.security = merged.security;
  current.email = merged.email;
  current.infrastructure = merged.infrastructure;
  current.idGeneration = merged.idGeneration;
  current.updatedBy = userId || null;
  await current.save();

  return getSystemSettings();
}

export async function getSecuritySettings() {
  const settings = await ensureSystemSettings();
  return getSecuritySettingsFromDoc(settings);
}

export async function getInfrastructureSettings() {
  const settings = await ensureSystemSettings();
  return settings.infrastructure?.toObject?.() || settings.infrastructure || {};
}

export async function getCompanyIdConfig() {
  const settings = await ensureSystemSettings();
  return normalizeIdConfig(settings.idGeneration?.company, DEFAULT_COMPANY_ID_CONFIG);
}

export async function getEffectiveSecuritySettings({ companyId = null, workspaceId = null } = {}) {
  const globalSettings = await getSecuritySettings();

  if (!companyId || !workspaceId) {
    return globalSettings;
  }

  const { Workspace } = await getTenantModels(companyId);
  const workspace = await Workspace.findOne({ _id: workspaceId, tenantId: companyId }).select('settings.security');
  if (!workspace) {
    return globalSettings;
  }

  return {
    ...globalSettings,
    ...(workspace.settings?.security?.toObject?.() || workspace.settings?.security || {}),
  };
}

export function assertPasswordMatchesPolicy(password, securitySettings = DEFAULT_SECURITY_SETTINGS) {
  const trimmedPassword = String(password || '');
  if (trimmedPassword.length < 8) {
    const err = new Error('Password must be at least 8 characters long');
    err.statusCode = 400;
    err.code = 'WEAK_PASSWORD';
    throw err;
  }

  if (!securitySettings.strongPasswords) return;

  const hasUpper = /[A-Z]/.test(trimmedPassword);
  const hasLower = /[a-z]/.test(trimmedPassword);
  const hasDigit = /\d/.test(trimmedPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(trimmedPassword);

  if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
    const err = new Error('Strong password policy requires uppercase, lowercase, number, and special character');
    err.statusCode = 400;
    err.code = 'WEAK_PASSWORD';
    throw err;
  }
}

export async function assertPasswordAllowed(password, context = {}) {
  const security = await getEffectiveSecuritySettings(context);
  assertPasswordMatchesPolicy(password, security);
}

export async function clearCache() {
  return {
    ok: true,
    clearedAt: new Date().toISOString(),
  };
}

export async function refreshSystemData() {
  return getSystemSettings();
}

export async function testEmailSettings({ email }) {
  const candidate = normalizeEmailSettings(email || DEFAULT_EMAIL_SETTINGS, {
    siteName: 'Gitakshmi PMS',
    supportEmail: email?.username || 'gitakshmi@support.com',
    adminEmail: 'admin@gmail.com',
  });
  return verifyMailSettings(candidate);
}

export function getDefaultEmailTemplateMap() {
  return DEFAULT_TEMPLATE_MAP;
}

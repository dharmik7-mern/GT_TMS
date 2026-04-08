import Company from '../models/Company.js';
import AuthLookup from '../models/AuthLookup.js';
import { buildTenantDatabaseName, getTenantModels } from '../config/tenantDb.js';

import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { sha256 } from '../utils/crypto.js';
import { assertPasswordAllowed, formatGeneratedId, getCompanyIdConfig, getInfrastructureSettings, getSecuritySettings } from './settings.service.js';

async function reserveOrganizationId() {
  const config = await getCompanyIdConfig();
  let nextSequence = config.nextSequence;
  let organizationId = formatGeneratedId(config, nextSequence);

  while (await Company.exists({ organizationId })) {
    nextSequence += 1;
    organizationId = formatGeneratedId(config, nextSequence);
  }

  return organizationId;
}

function nowPlusDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function parseTtlToMs(ttl) {
  // Supports simple JWT TTL strings like: "15m", "8h", "30d", "90d"
  // Defaults to days when format is unknown.
  if (!ttl || typeof ttl !== 'string') return 30 * 24 * 60 * 60 * 1000;
  const m = ttl.trim().match(/^(\d+)\s*([smhdw])$/i);
  if (!m) {
    // Fall back for values like "1" or "30D"
    const num = Number(ttl);
    if (Number.isFinite(num)) return num * 24 * 60 * 60 * 1000;
    return 30 * 24 * 60 * 60 * 1000;
  }
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  return value * (multipliers[unit] || (24 * 60 * 60 * 1000));
}

function toAuthUser(user, workspaceId) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    jobTitle: user.jobTitle,
    bio: user.bio,
    department: user.department,
    workspaceId: workspaceId ? String(workspaceId) : '',
    createdAt: user.createdAt?.toISOString?.() || new Date().toISOString(),
    isActive: user.isActive,
    canUsePrivateQuickTasks: Boolean(user.canUsePrivateQuickTasks),
    color: user.color,
    preferences: user.preferences,
  };
}

export async function register({ name, email, password, workspaceName }) {
  const security = await getSecuritySettings();
  if (!security.openRegistration) {
    const err = new Error('Open registration is currently disabled');
    err.statusCode = 403;
    err.code = 'REGISTRATION_DISABLED';
    throw err;
  }

  await assertPasswordAllowed(password);

  // For multi-tenant: each self-signup creates a Company + Workspace.
  // In real enterprise SaaS you might restrict this to super_admin onboarding,
  // but your UI includes signup -> create workspace.
  const organizationId = await reserveOrganizationId();
  const company = await Company.create({
    organizationId,
    name: workspaceName || `${name}'s Company`,
    email: email.toLowerCase(),
    databaseName: buildTenantDatabaseName({ companyName: workspaceName || `${name}'s Company`, organizationId }),
    status: 'trial',
    color: '#3366ff',
  });

  await AuthLookup.updateOne(
    { email: email.toLowerCase() },
    { $set: { email: email.toLowerCase(), tenantId: company._id } },
    { upsert: true }
  );

  const { User, Workspace, Membership } = await getTenantModels(company._id);

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    tenantId: company._id,
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: 'admin',
    isActive: true,
  });

  const slug = (workspaceName || 'workspace').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const workspace = await Workspace.create({
    tenantId: company._id,
    name: workspaceName || `${name}'s Workspace`,
    slug: slug || `ws-${company.id.slice(-6)}`,
    plan: 'pro',
    ownerId: user._id,
  });

  await Membership.create({
    tenantId: company._id,
    workspaceId: workspace._id,
    userId: user._id,
    role: 'admin',
    status: 'active',
  });

  return await issueTokens({ userId: user._id, companyId: company._id, workspaceId: workspace._id });
}

export async function login({ email, companyCode, employeeCode, password }) {
  const infrastructure = await getInfrastructureSettings();
  let user;
  let Membership;

  if (typeof email === 'string' && email.trim()) {
    const normalizedEmail = email.trim().toLowerCase();
    const lookup = await AuthLookup.findOne({ email: normalizedEmail });
    if (!lookup) {
      const err = new Error('Invalid credentials');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const tenantModels = await getTenantModels(lookup.tenantId);
    Membership = tenantModels.Membership;
    user = await tenantModels.User.findOne({ email: normalizedEmail, tenantId: lookup.tenantId }).select('+passwordHash');
  } else {
    const normalizedCompanyCode = String(companyCode || '').trim().toUpperCase();
    const normalizedEmployeeCode = String(employeeCode || '').trim().toUpperCase();
    const company = await Company.findOne({ organizationId: normalizedCompanyCode }).select('_id');

    if (!company || !normalizedEmployeeCode) {
      const err = new Error('Invalid credentials');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const tenantModels = await getTenantModels(company._id);
    Membership = tenantModels.Membership;
    user = await tenantModels.User.findOne({
      tenantId: company._id,
      employeeId: normalizedEmployeeCode,
    }).select('+passwordHash');
  }

  if (!user || !user.isActive) {
    const err = new Error(user && !user.isActive ? 'Your account is disabled. Contact admin.' : 'Invalid credentials');
    err.statusCode = 401;
    err.code = user && !user.isActive ? 'USER_DISABLED' : 'INVALID_CREDENTIALS';
    throw err;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  if (infrastructure?.maintenanceMode && !['super_admin', 'admin'].includes(user.role)) {
    const err = new Error('The platform is currently in maintenance mode');
    err.statusCode = 503;
    err.code = 'MAINTENANCE_MODE';
    throw err;
  }

  const membership = await Membership.findOne({ userId: user._id, status: 'active' }).sort({ createdAt: 1 });
  if (!membership) {
    const err = new Error('No active workspace membership');
    err.statusCode = 403;
    err.code = 'NO_WORKSPACE';
    throw err;
  }

  // Ensure role is consistent with membership (optional policy). We'll trust user.role for now.
  return await issueTokens({ userId: user._id, companyId: user.tenantId, workspaceId: membership.workspaceId });
}

export async function refresh({ refreshToken, userAgent, ip }) {
  const decoded = verifyRefreshToken(refreshToken);
  const tokenHash = sha256(refreshToken);

  const { RefreshToken: RefreshTokenLookup } = await getTenantModels(decoded?.companyId || null);
  const existing = await RefreshTokenLookup.findOne({ tokenHash });
  if (!existing || existing.revokedAt) {
    const err = new Error('Refresh token revoked');
    err.statusCode = 401;
    err.code = 'TOKEN_REVOKED';
    throw err;
  }

  const { RefreshToken, User, Membership } = await getTenantModels(existing.tenantId);

  if (existing.expiresAt.getTime() < Date.now()) {
    const err = new Error('Refresh token expired');
    err.statusCode = 401;
    err.code = 'TOKEN_EXPIRED';
    throw err;
  }

  // Rotate: revoke old, issue new
  existing.revokedAt = new Date();
  await existing.save();

  const user = await User.findById(existing.userId);
  if (!user || !user.isActive) {
    const err = new Error('User disabled');
    err.statusCode = 401;
    err.code = 'USER_DISABLED';
    throw err;
  }

  const membership = await Membership.findOne({ userId: user._id, status: 'active' }).sort({ createdAt: 1 });
  if (!membership) {
    const err = new Error('No active workspace membership');
    err.statusCode = 403;
    err.code = 'NO_WORKSPACE';
    throw err;
  }

  return await issueTokens({
    userId: user._id,
    companyId: user.tenantId,
    workspaceId: membership.workspaceId,
    rotatedFromHash: tokenHash,
    userAgent,
    ip,
  });
}

export async function logout({ refreshToken }) {
  if (!refreshToken) return;
  const tokenHash = sha256(refreshToken);
  const decoded = verifyRefreshToken(refreshToken);
  const { RefreshToken } = await getTenantModels(decoded?.companyId || null);
  await RefreshToken.updateOne({ tokenHash }, { $set: { revokedAt: new Date() } });
}

async function issueTokens({ userId, companyId, workspaceId, rotatedFromHash = null, userAgent = null, ip = null }) {
  const tenantId = companyId;
  const { User, RefreshToken } = await getTenantModels(tenantId);
  const user = await User.findOne({ _id: userId, tenantId });
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const accessToken = signAccessToken({
    sub: String(user._id),
    companyId: String(tenantId),
    workspaceId: String(workspaceId),
    role: user.role,
    name: user.name,
  });

  const refreshToken = signRefreshToken({
    sub: String(user._id),
    companyId: String(tenantId),
    // workspace can change; refresh token stays user/company scoped
  });

  const refreshHash = sha256(refreshToken);
  await RefreshToken.create({
    userId,
    tenantId,
    tokenHash: refreshHash,
    rotatedFromHash,
    expiresAt: new Date(Date.now() + parseTtlToMs(process.env.JWT_REFRESH_TTL || '90d')),
    userAgent,
    ip,
  });

  return {
    accessToken,
    refreshToken,
    user: toAuthUser(user.toJSON(), workspaceId),
  };
}


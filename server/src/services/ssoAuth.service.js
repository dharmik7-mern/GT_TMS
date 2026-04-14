import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Company from '../models/Company.js';
import AuthLookup from '../models/AuthLookup.js';
import SSOAuditLog from '../models/SSOAuditLog.js';
import { buildTenantDatabaseName, getTenantModels } from '../config/tenantDb.js';
import { hashPassword } from '../utils/password.js';
import { normalizeRole } from '../utils/roles.js';
import { signSsoToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

class SSOFlowError extends Error {
  constructor(message, { statusCode = 400, reason = 'sso_error' } = {}) {
    super(message);
    this.name = 'SSOFlowError';
    this.statusCode = statusCode;
    this.reason = reason;
  }
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function decodePem(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.includes('-----BEGIN')) return raw.replace(/\\n/g, '\n');
  try {
    return Buffer.from(raw, 'base64').toString('utf-8');
  } catch {
    return raw.replace(/\\n/g, '\n');
  }
}

function parseTtlToMs(ttl) {
  const m = String(ttl || '').trim().match(/^(\d+)\s*([smhdw])$/i);
  if (!m) return 5 * 60 * 1000;
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  const table = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  return value * (table[unit] || 5 * 60 * 1000);
}

function parseTrustedOrigins(value) {
  const parsed = parseCsv(value).map((origin) => {
    try {
      return new URL(origin).origin;
    } catch {
      return '';
    }
  }).filter(Boolean);

  const expanded = new Set(parsed);
  for (const origin of parsed) {
    expanded.add(origin.replace('http://localhost:', 'http://127.0.0.1:'));
    expanded.add(origin.replace('http://127.0.0.1:', 'http://localhost:'));
  }
  return Array.from(expanded);
}

function clampSsoRole(role) {
  const normalized = normalizeRole(role);
  // SSO should stay company-scoped; avoid granting platform-wide super_admin via SSO.
  if (normalized === 'super_admin') return 'admin';
  return normalized;
}

export function resolveSsoConfig(env = process.env) {
  const audienceValues = Array.from(new Set([
    ...parseCsv(env.SSO_EXPECTED_AUDIENCE || env.JWT_AUDIENCE || ''),
    'sso',
  ]));
  const expectedAudience = audienceValues.length > 1 ? audienceValues : (audienceValues[0] || '');
  return {
    expectedIssuer: String(env.SSO_EXPECTED_ISSUER || env.JWT_ISSUER || '').trim(),
    expectedAudience,
    verificationSecret: String(env.SSO_SECRET || env.SSO_JWT_SECRET || '').trim(),
    verificationPublicKey: decodePem(env.PUBLIC_KEY || env.SSO_PUBLIC_KEY),
    verificationAlgorithms: parseCsv(env.SSO_TOKEN_ALGORITHMS || 'HS256,RS256'),
    tokenExpiry: String(env.TOKEN_EXPIRY || env.JWT_ACCESS_TTL || '5m').trim(),
    hrmsSsoUrl: String(env.HRMS_SSO_URL || '').trim(),
    tmsCallbackUrl: String(env.TMS_CALLBACK_URL || '').trim(),
    trustedOrigins: parseTrustedOrigins(env.SSO_TRUSTED_DOMAINS || env.CORS_ORIGIN || ''),
  };
}

function classifyTokenError(error) {
  if (error?.name === 'TokenExpiredError') return 'token_expired';
  if (error?.name === 'JsonWebTokenError') return 'invalid_token';
  return 'invalid_token';
}

function readAudience(aud) {
  if (Array.isArray(aud)) return aud.join(',');
  return String(aud || '');
}

function ensureTrustedRequest({ origin, referer, trustedOrigins }) {
  if (!Array.isArray(trustedOrigins) || trustedOrigins.length === 0) return;
  const candidates = [];
  if (origin) candidates.push(origin);
  if (referer) {
    try {
      candidates.push(new URL(referer).origin);
    } catch {
      // ignore invalid referer
    }
  }
  if (candidates.length === 0) return;
  const isLocalDevCandidate = candidates.every((value) => /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(value || '').trim()));
  if (process.env.NODE_ENV !== 'production' && isLocalDevCandidate) {
    return;
  }
  const trusted = candidates.some((value) => trustedOrigins.includes(value));
  if (!trusted) {
    throw new SSOFlowError('Untrusted SSO source domain', {
      statusCode: 403,
      reason: 'untrusted_domain',
    });
  }
}

function pickTokenSigningKey(config) {
  if (config.verificationPublicKey) return config.verificationPublicKey;
  if (config.verificationSecret) return config.verificationSecret;
  throw new SSOFlowError('SSO verification key is not configured', {
    statusCode: 500,
    reason: 'sso_key_missing',
  });
}

function verifyIncomingToken(token, config) {
  try {
    return jwt.verify(token, pickTokenSigningKey(config), {
      algorithms: config.verificationAlgorithms.length ? config.verificationAlgorithms : ['HS256'],
      issuer: config.expectedIssuer || undefined,
      audience: config.expectedAudience || undefined,
      clockTolerance: 5,
    });
  } catch (error) {
    throw new SSOFlowError('Invalid or expired SSO token', {
      statusCode: 401,
      reason: classifyTokenError(error),
    });
  }
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email || null;
}

function normalizeEmployeeId(value) {
  const employeeId = String(value || '').trim();
  return employeeId || null;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveTenantFromClaims(claims, deps) {
  const tenantIdClaim = String(
    claims.companyId || claims.tenantId || claims.orgId || claims.organizationId || ''
  ).trim();
  const companyCode = String(claims.companyCode || claims.organizationCode || '').trim().toUpperCase();
  const email = normalizeEmail(claims.email);

  if (tenantIdClaim) {
    const byId = await deps.Company.findById(tenantIdClaim).select('_id organizationId').lean();
    if (byId?._id) return { id: String(byId._id), companyCode: byId.organizationId || companyCode || null };
  }

  if (companyCode) {
    const byCode = await deps.Company.findOne({ organizationId: companyCode }).select('_id organizationId').lean();
    if (byCode?._id) return { id: String(byCode._id), companyCode: byCode.organizationId || companyCode };
  }

  if (email) {
    const lookup = await deps.AuthLookup.findOne({ email }).select('tenantId').lean();
    if (lookup?.tenantId) return { id: String(lookup.tenantId), companyCode: companyCode || null };
    const byEmail = await deps.Company.findOne({
      email: new RegExp(`^${escapeRegExp(email)}$`, 'i'),
    }).select('_id organizationId').lean();
    if (byEmail?._id) return { id: String(byEmail._id), companyCode: byEmail.organizationId || companyCode || null };
  }

  if (tenantIdClaim && mongoose.Types.ObjectId.isValid(tenantIdClaim)) {
    const organizationId = (companyCode || `ORG${tenantIdClaim.slice(-6)}`).slice(0, 80);
    const companyName = String(
      claims.companyName || claims.tenantName || claims.organizationName || companyCode || email || 'GT One Company'
    ).trim();
    const companyEmail = email || `${organizationId.toLowerCase()}@local.sso`;
    try {
      const created = await deps.Company.create({
        _id: new mongoose.Types.ObjectId(tenantIdClaim),
        organizationId,
        name: companyName,
        email: companyEmail,
        databaseName: buildTenantDatabaseName({ companyName, organizationId }),
        status: 'active',
      });
      return { id: String(created._id), companyCode: organizationId };
    } catch (error) {
      if (error?.code === 11000) {
        const candidates = [];
        if (tenantIdClaim) {
          candidates.push(
            deps.Company.findById(tenantIdClaim).select('_id organizationId').lean()
          );
        }
        if (companyEmail) {
          candidates.push(
            deps.Company.findOne({ email: new RegExp(`^${escapeRegExp(companyEmail)}$`, 'i') }).select('_id organizationId').lean()
          );
        }
        if (organizationId) {
          candidates.push(
            deps.Company.findOne({ organizationId }).select('_id organizationId').lean()
          );
        }
        if (companyCode && companyCode !== organizationId) {
          candidates.push(
            deps.Company.findOne({ organizationId: companyCode }).select('_id organizationId').lean()
          );
        }

        const resolvedCandidates = await Promise.all(candidates);
        const existing = resolvedCandidates.find((item) => item?._id);
        if (existing?._id) {
          return {
            id: String(existing._id),
            companyCode: existing.organizationId || organizationId || companyCode || null,
          };
        }
      }
      if (process.env.NODE_ENV !== 'production' && tenantIdClaim) {
        return {
          id: String(tenantIdClaim),
          companyCode: organizationId || companyCode || null,
        };
      }
      throw error;
    }
  }

  throw new SSOFlowError('Tenant resolution failed for SSO user', {
    statusCode: 403,
    reason: 'tenant_not_found',
  });
}

function buildProvisionedUserPayload({ claims, tenantId }) {
  const email = normalizeEmail(claims.email);
  const employeeId = normalizeEmployeeId(claims.employeeId || claims.employeeCode);
  const name = String(claims.name || claims.fullName || email || employeeId || 'SSO User').trim();
  const role = clampSsoRole(claims.role || claims.userRole);
  const randomSecret = crypto.randomBytes(24).toString('hex');
  return {
    tenantId,
    name,
    email,
    employeeId,
    role,
    randomSecret,
  };
}

async function ensureWorkspace({ tenantId, user, claims, models }) {
  const workspaceClaim = String(claims.workspaceId || '').trim();
  let workspace = null;

  if (workspaceClaim) {
    workspace = await models.Workspace.findOne({ _id: workspaceClaim, tenantId }).select('_id name').lean();
  }
  if (!workspace) {
    const existingMembership = await models.Membership.findOne({
      tenantId,
      userId: user._id,
      status: 'active',
    }).sort({ createdAt: 1 }).lean();
    if (existingMembership?.workspaceId) {
      workspace = await models.Workspace.findOne({ _id: existingMembership.workspaceId, tenantId }).select('_id name').lean();
    }
  }
  if (!workspace) {
    workspace = await models.Workspace.findOne({ tenantId }).sort({ createdAt: 1 }).select('_id name').lean();
  }
  if (!workspace) {
    const baseName = String(claims.companyName || claims.tenantName || 'Main Workspace').trim();
    const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `ws-${String(tenantId).slice(-6)}`;
    const created = await models.Workspace.create({
      tenantId,
      name: baseName,
      slug: `${slug}-${Date.now().toString().slice(-4)}`,
      ownerId: user._id,
      plan: 'pro',
    });
    workspace = { _id: created._id, name: created.name };
  }

  return workspace;
}

async function ensureMembership({ tenantId, workspaceId, userId, role, models }) {
  const existing = await models.Membership.findOne({
    tenantId,
    workspaceId,
    userId,
  });

  if (!existing) {
    await models.Membership.create({
      tenantId,
      workspaceId,
      userId,
      role,
      status: 'active',
    });
    return;
  }

  const nextRole = clampSsoRole(role || existing.role);
  if (existing.status !== 'active' || existing.role !== nextRole) {
    existing.status = 'active';
    existing.role = nextRole;
    await existing.save();
  }
}

function getRequestContext(requestContext = {}) {
  return {
    ip: requestContext.ip || null,
    userAgent: requestContext.userAgent || null,
    origin: requestContext.origin || null,
    referer: requestContext.referer || null,
  };
}

async function writeAudit(event, payload) {
  try {
    await SSOAuditLog.create({ event, ...payload });
  } catch (error) {
    logger.warn('sso_audit_persist_failed', {
      event,
      reason: payload?.reason || null,
      message: error.message,
    });
  }
}

function buildUserSessionPayload({ user, tenantId, workspaceId, companyCode }) {
  return {
    sub: String(user._id),
    companyId: String(tenantId),
    tenantId: String(tenantId),
    workspaceId: String(workspaceId),
    role: clampSsoRole(user.role),
    name: user.name || null,
    email: user.email || null,
    employeeId: user.employeeId || null,
    companyCode: companyCode || null,
  };
}

function toSessionUser({ user, tenantId, workspaceId, companyCode }) {
  return {
    id: String(user._id),
    name: user.name || '',
    email: user.email || null,
    employeeId: user.employeeId || null,
    role: clampSsoRole(user.role),
    companyId: String(tenantId),
    tenantId: String(tenantId),
    workspaceId: String(workspaceId),
    companyCode: companyCode || null,
    avatar: user.avatar || null,
    jobTitle: user.jobTitle || null,
    department: user.department || null,
  };
}

export async function completeSsoLogin({ token, requestContext = {}, config = resolveSsoConfig() }, overrides = {}) {
  const deps = {
    Company: overrides.Company || Company,
    AuthLookup: overrides.AuthLookup || AuthLookup,
    getTenantModels: overrides.getTenantModels || getTenantModels,
    hashPassword: overrides.hashPassword || hashPassword,
    signSsoToken: overrides.signSsoToken || signSsoToken,
    writeAudit: overrides.writeAudit || writeAudit,
  };
  const context = getRequestContext(requestContext);

  if (!token || typeof token !== 'string') {
    throw new SSOFlowError('Missing SSO token', { statusCode: 400, reason: 'missing_token' });
  }

  ensureTrustedRequest({
    origin: context.origin,
    referer: context.referer,
    trustedOrigins: config.trustedOrigins,
  });

  let claims;
  let tenant = null;
  let user = null;
  let workspaceId = null;
  let autoProvisioned = false;

  try {
    claims = verifyIncomingToken(token, config);
    tenant = await resolveTenantFromClaims(claims, deps);
    const tenantId = tenant.id;
    const email = normalizeEmail(claims.email);
    const employeeId = normalizeEmployeeId(claims.employeeId || claims.employeeCode);
    const models = await deps.getTenantModels(tenantId);
    const roleFromToken = clampSsoRole(claims.role || claims.userRole);

    const identityFilter = [
      ...(email ? [{ email }] : []),
      ...(employeeId ? [{ employeeId }] : []),
    ];
    const userQuery = identityFilter.length
      ? { tenantId, $or: identityFilter }
      : { tenantId, _id: null };
    user = await models.User.findOne(userQuery).select('+passwordHash');

    if (!user) {
      const provision = buildProvisionedUserPayload({ claims, tenantId });
      if (!provision.email && !provision.employeeId) {
        throw new SSOFlowError('Cannot provision user without email or employeeId', {
          statusCode: 400,
          reason: 'missing_identity_claims',
        });
      }
      const passwordHash = await deps.hashPassword(provision.randomSecret);
      user = await models.User.create({
        tenantId,
        name: provision.name,
        email: provision.email || `${provision.employeeId}@local.sso`,
        employeeId: provision.employeeId,
        role: provision.role,
        passwordHash,
        isActive: true,
      });
      autoProvisioned = true;
      if (provision.email) {
        await deps.AuthLookup.updateOne(
          { email: provision.email },
          { $set: { email: provision.email, tenantId } },
          { upsert: true }
        );
      }
    }

    if (!user.isActive) {
      user.isActive = true;
    }
    if (roleFromToken && user.role !== roleFromToken) {
      user.role = roleFromToken;
    }
    if (!user.employeeId && employeeId) {
      user.employeeId = employeeId;
    }
    if (!user.email && email) {
      user.email = email;
    }
    if (!user.name && claims.name) {
      user.name = String(claims.name).trim();
    }
    if (user.isModified?.()) {
      await user.save();
    }

    const workspace = await ensureWorkspace({ tenantId, user, claims, models });
    workspaceId = String(workspace._id);
    await ensureMembership({
      tenantId,
      workspaceId,
      userId: user._id,
      role: user.role,
      models,
    });

    const localSessionToken = deps.signSsoToken(buildUserSessionPayload({
      user,
      tenantId,
      workspaceId,
      companyCode: tenant.companyCode || null,
    }));

    await deps.writeAudit('sso_login', {
      outcome: 'success',
      reason: null,
      message: 'SSO login completed',
      issuer: claims.iss || null,
      audience: readAudience(claims.aud),
      subject: String(claims.sub || ''),
      email: normalizeEmail(claims.email),
      employeeId: normalizeEmployeeId(claims.employeeId || claims.employeeCode),
      tenantId: String(tenantId),
      workspaceId,
      userId: String(user._id),
      autoProvisioned,
      ...context,
      metadata: {
        exp: claims.exp || null,
        tokenIat: claims.iat || null,
      },
    });

    return {
      accessToken: localSessionToken,
      cookieMaxAgeMs: parseTtlToMs(config.tokenExpiry),
      user: toSessionUser({
        user,
        tenantId,
        workspaceId,
        companyCode: tenant.companyCode || null,
      }),
      autoProvisioned,
    };
  } catch (error) {
    console.error('[TMS SSO] completeSsoLogin failed:', error);
    logger.error('sso_login_failed_unexpected', {
      reason: error?.reason || error?.code || 'server_error',
      message: error?.message || 'Unknown error',
      stack: error?.stack || null,
      tenantId: tenant?.id || null,
      email: normalizeEmail(claims?.email),
    });
    const safeReason = error?.reason || 'server_error';
    await deps.writeAudit('sso_login', {
      outcome: 'failure',
      reason: safeReason,
      message: error.message || 'SSO login failed',
      issuer: claims?.iss || null,
      audience: readAudience(claims?.aud),
      subject: claims?.sub ? String(claims.sub) : null,
      email: normalizeEmail(claims?.email),
      employeeId: normalizeEmployeeId(claims?.employeeId || claims?.employeeCode),
      tenantId: tenant?.id || null,
      workspaceId: workspaceId || null,
      userId: user?._id ? String(user._id) : null,
      autoProvisioned,
      ...context,
      metadata: {},
    });
    if (error instanceof SSOFlowError) throw error;
    throw new SSOFlowError('Unable to complete SSO login', {
      statusCode: 500,
      reason: 'server_error',
    });
  }
}

export async function completeSsoLogoutSync({ token, requestContext = {}, config = resolveSsoConfig() }, overrides = {}) {
  const deps = {
    Company: overrides.Company || Company,
    AuthLookup: overrides.AuthLookup || AuthLookup,
    getTenantModels: overrides.getTenantModels || getTenantModels,
    writeAudit: overrides.writeAudit || writeAudit,
  };
  const context = getRequestContext(requestContext);

  if (!token || typeof token !== 'string') {
    throw new SSOFlowError('Missing SSO logout token', { statusCode: 400, reason: 'missing_token' });
  }

  ensureTrustedRequest({
    origin: context.origin,
    referer: context.referer,
    trustedOrigins: config.trustedOrigins,
  });

  let claims;
  let tenant = null;

  try {
    claims = verifyIncomingToken(token, config);
    const event = String(claims.event || claims.type || '').trim().toLowerCase();
    if (event && event !== 'logout') {
      throw new SSOFlowError('Invalid SSO logout event', { statusCode: 400, reason: 'invalid_logout_event' });
    }

    tenant = await resolveTenantFromClaims(claims, deps);
    const tenantId = tenant.id;
    const models = await deps.getTenantModels(tenantId);
    const email = normalizeEmail(claims.email);
    const employeeId = normalizeEmployeeId(claims.employeeId || claims.employeeCode);

    const identityFilter = [
      ...(email ? [{ email }] : []),
      ...(employeeId ? [{ employeeId }] : []),
    ];
    const userQuery = identityFilter.length
      ? { tenantId, $or: identityFilter }
      : { tenantId, _id: null };
    const user = await models.User.findOne(userQuery).select('_id').lean();

    if (user?._id) {
      await models.RefreshToken.updateMany(
        { tenantId, userId: user._id, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }

    await deps.writeAudit('sso_logout_sync', {
      outcome: 'success',
      reason: null,
      message: 'SSO logout sync completed',
      issuer: claims.iss || null,
      audience: readAudience(claims.aud),
      subject: String(claims.sub || ''),
      email,
      employeeId,
      tenantId: String(tenantId),
      workspaceId: String(claims.workspaceId || ''),
      userId: user?._id ? String(user._id) : null,
      autoProvisioned: false,
      ...context,
      metadata: {},
    });

    return { ok: true, tenantId: String(tenantId), userId: user?._id ? String(user._id) : null };
  } catch (error) {
    await deps.writeAudit('sso_logout_sync', {
      outcome: 'failure',
      reason: error?.reason || 'server_error',
      message: error.message || 'SSO logout sync failed',
      issuer: claims?.iss || null,
      audience: readAudience(claims?.aud),
      subject: claims?.sub ? String(claims.sub) : null,
      email: normalizeEmail(claims?.email),
      employeeId: normalizeEmployeeId(claims?.employeeId || claims?.employeeCode),
      tenantId: tenant?.id || null,
      workspaceId: String(claims?.workspaceId || ''),
      userId: null,
      autoProvisioned: false,
      ...context,
      metadata: {},
    });
    if (error instanceof SSOFlowError) throw error;
    throw new SSOFlowError('Unable to sync logout', {
      statusCode: 500,
      reason: 'server_error',
    });
  }
}

export function buildHrmsRedirectUrl({ reason, fallbackUrl, returnTo }) {
  const base = String(fallbackUrl || '').trim();
  if (!base) return null;
  try {
    const url = new URL(base);
    if (reason) url.searchParams.set('sso_error', reason);
    if (returnTo) url.searchParams.set('redirect', returnTo);
    return url.toString();
  } catch {
    return null;
  }
}

export { SSOFlowError };

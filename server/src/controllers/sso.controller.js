import { signSsoToken, verifySsoToken } from '../utils/jwt.js';
import { getTenantModels } from '../config/tenantDb.js';
import { normalizeRole } from '../utils/roles.js';
import { classifyJwtFailure, logAuthFailure } from '../utils/authFailure.js';
import {
  buildHrmsRedirectUrl,
  completeSsoLogin,
  completeSsoLogoutSync,
  resolveSsoConfig,
  SSOFlowError,
} from '../services/ssoAuth.service.js';

/**
 * Build the SSO cookie options.
 * In development (non-HTTPS) we relax secure + sameSite so the cookie works
 * on localhost. In production we enforce the secure cross-domain settings.
 */
function buildCookieOptions(maxAgeMs) {
  const isProd = process.env.NODE_ENV === 'production';
  const domain = process.env.SSO_COOKIE_DOMAIN || undefined; // e.g. ".gitakshmi.com"

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'None' : 'Lax',
    domain,
    maxAge: maxAgeMs || 24 * 60 * 60 * 1000,
    path: '/',
  };
}

const ACCESS_TTL_MS = parseTtlToMs(process.env.TOKEN_EXPIRY || process.env.JWT_ACCESS_TTL || '8h');
const SHARED_SSO_COOKIE_NAME = 'sso_token';
const LOCAL_SSO_COOKIE_NAME = 'tms_sso_token';

function parseTtlToMs(ttl) {
  if (!ttl || typeof ttl !== 'string') return 8 * 60 * 60 * 1000;
  const m = ttl.trim().match(/^(\d+)\s*([smhdw])$/i);
  if (!m) return 8 * 60 * 60 * 1000;
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return value * (multipliers[unit] || 3600000);
}

function buildPermissionsPayload({ role, companyId, workspaceId }) {
  const normalizedRole = normalizeRole(role);
  const mappedRole = normalizedRole === 'super_admin' ? 'admin' : normalizedRole;

  const moduleMatrix = {
    super_admin: ['dashboard', 'projects', 'tasks', 'teams', 'reports', 'mis', 'settings', 'companies', 'users', 'roles_permissions'],
    company_admin: ['dashboard', 'projects', 'tasks', 'teams', 'reports', 'mis', 'settings', 'users'],
    admin: ['dashboard', 'projects', 'tasks', 'teams', 'reports', 'mis', 'settings', 'users'],
    manager: ['dashboard', 'projects', 'tasks', 'teams', 'reports', 'mis'],
    team_leader: ['dashboard', 'projects', 'tasks', 'teams', 'reports'],
    team_member: ['dashboard', 'projects', 'tasks'],
  };

  return {
    role: mappedRole,
    modules: moduleMatrix[mappedRole] || moduleMatrix.team_member,
    tenant: {
      companyId: String(companyId || ''),
      workspaceId: String(workspaceId || ''),
    },
  };
}

function readAccessTokenFromRequest(req) {
  const cookieToken = req.cookies?.[SHARED_SSO_COOKIE_NAME] || req.cookies?.[LOCAL_SSO_COOKIE_NAME] || req.cookies?.token || req.cookies?.access_token;
  const headerAuth = req.headers.authorization || '';
  const [scheme, headerToken] = headerAuth.split(' ');
  return cookieToken || (scheme === 'Bearer' ? headerToken : null);
}

async function resolveSessionUser(req) {
  const token = readAccessTokenFromRequest(req);
  if (!token) {
    return { ok: false, statusCode: 401, reason: 'no_token', message: 'No session' };
  }

  let decoded;
  try {
    decoded = verifySsoToken(token);
  } catch (error) {
    const reason = classifyJwtFailure(error);
    const message = reason === 'token_expired' ? 'Session expired' : 'Invalid session token';
    return { ok: false, statusCode: 401, reason, message };
  }

  let freshUser = null;
  let tenantId = null;
  try {
    tenantId = decoded.companyId || decoded.tenantId || decoded.orgId || decoded.organizationId;
    const { User, Membership, Workspace } = await getTenantModels(tenantId);
    const identityFilters = [
      { _id: decoded.sub },
      ...(decoded.email ? [{ email: decoded.email }] : []),
      ...(decoded.employeeId ? [{ employeeId: decoded.employeeId }] : []),
    ];
    freshUser = await User.findOne({
      tenantId,
      isActive: true,
      $or: identityFilters,
    })
      .select('name email role avatar jobTitle department')
      .lean();

    if (freshUser) {
      let resolvedWorkspaceId = decoded.workspaceId || null;
      if (!resolvedWorkspaceId) {
        const localUserId = String(freshUser._id || decoded.sub || '');
        const membership = await Membership.findOne({
          tenantId,
          userId: localUserId,
          status: 'active',
        })
          .sort({ createdAt: 1 })
          .select('workspaceId')
          .lean();
        if (membership?.workspaceId) {
          resolvedWorkspaceId = String(membership.workspaceId);
        }
      }
      decoded.workspaceId = resolvedWorkspaceId || decoded.workspaceId || null;
    } else if (decoded.email || decoded.employeeId) {
      const role = normalizeRole(decoded.role);
      const createdUser = await User.create({
        tenantId,
        name: decoded.name || decoded.email || decoded.employeeId || 'SSO User',
        email: decoded.email || `${decoded.employeeId || 'user'}@local.sso`,
        employeeId: decoded.employeeId || undefined,
        passwordHash: `sso:${decoded.sub}`,
        role,
        isActive: true,
      });

      let workspace = null;
      if (decoded.workspaceId) {
        workspace = await Workspace.findOne({ _id: decoded.workspaceId, tenantId }).lean();
      }
      if (!workspace) {
        workspace = await Workspace.findOne({ tenantId }).sort({ createdAt: 1 }).lean();
      }
      if (!workspace) {
        const workspaceName = String(decoded.companyCode || decoded.name || 'Main Workspace').trim();
        const slug = workspaceName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || `ws-${String(tenantId).slice(-6)}`;
        const createdWorkspace = await Workspace.create({
          tenantId,
          name: workspaceName,
          slug,
          ownerId: createdUser._id,
          plan: 'pro',
        });
        workspace = createdWorkspace.toObject();
      }

      await Membership.updateOne(
        { tenantId, workspaceId: workspace._id, userId: createdUser._id },
        { $set: { tenantId, workspaceId: workspace._id, userId: createdUser._id, role, status: 'active' } },
        { upsert: true }
      );

      freshUser = {
        _id: createdUser._id,
        name: createdUser.name,
        email: createdUser.email,
        role: createdUser.role,
        avatar: createdUser.avatar || null,
        jobTitle: createdUser.jobTitle || null,
        department: createdUser.department || null,
      };
      decoded.workspaceId = decoded.workspaceId || String(workspace._id);
    }
  } catch (error) {
    try {
      const bootstrap = await completeSsoLogin({
        token,
        requestContext: readRequestContext(req),
        config: resolveSsoConfig(),
      });

      return {
        ok: true,
        user: bootstrap.user,
        accessToken: bootstrap.accessToken,
        cookieMaxAgeMs: bootstrap.cookieMaxAgeMs,
        permissions: buildPermissionsPayload({
          role: bootstrap.user.role,
          companyId: bootstrap.user.companyId,
          workspaceId: bootstrap.user.workspaceId,
        }),
      };
    } catch {
      console.error('[TMS SSO] resolveSessionUser fallback failed:', error);
    }
  }

  if (freshUser === null && freshUser !== undefined) {
    try {
      const bootstrap = await completeSsoLogin({
        token,
        requestContext: readRequestContext(req),
        config: resolveSsoConfig(),
      });

      return {
        ok: true,
        user: bootstrap.user,
        accessToken: bootstrap.accessToken,
        cookieMaxAgeMs: bootstrap.cookieMaxAgeMs,
        permissions: buildPermissionsPayload({
          role: bootstrap.user.role,
          companyId: bootstrap.user.companyId,
          workspaceId: bootstrap.user.workspaceId,
        }),
      };
    } catch {
      if (process.env.NODE_ENV !== 'production') {
        const fallbackTenantId = decoded.companyId || decoded.tenantId || decoded.orgId || decoded.organizationId || null;
        if (fallbackTenantId) {
          const role = normalizeRole(decoded.role);
          const workspaceId = decoded.workspaceId || fallbackTenantId;
          const user = {
            id: String(decoded.sub),
            email: decoded.email || null,
            name: decoded.name || decoded.email || 'SSO User',
            role,
            companyId: String(fallbackTenantId),
            tenantId: String(fallbackTenantId),
            orgId: String(decoded.orgId || decoded.organizationId || fallbackTenantId),
            workspaceId: String(workspaceId),
            companyCode: decoded.companyCode || null,
            avatar: null,
            jobTitle: null,
            department: null,
          };

          return {
            ok: true,
            user,
            accessToken: signSsoToken({
              sub: user.id,
              companyId: user.companyId,
              tenantId: user.tenantId,
              workspaceId: user.workspaceId,
              role: user.role,
              name: user.name,
              email: user.email,
              employeeId: decoded.employeeId || null,
              companyCode: user.companyCode || null,
            }),
            cookieMaxAgeMs: ACCESS_TTL_MS,
            permissions: buildPermissionsPayload({
              role,
              companyId: user.companyId,
              workspaceId: user.workspaceId,
            }),
          };
        }
      }
      return {
        ok: false,
        statusCode: 403,
        reason: 'access_denied',
        message: 'User not found or inactive',
      };
    }
  }

  const role = normalizeRole(freshUser?.role || decoded.role);
  const sessionRole = role; // No longer mapping super_admin to admin here if we want to distinguish.

  const user = {
    id: String(freshUser?._id || decoded.sub),
    email: freshUser?.email || decoded.email || null,
    name: freshUser?.name || decoded.name || null,
    role: sessionRole,
    companyId: decoded.companyId || decoded.tenantId || decoded.orgId || decoded.organizationId,
    tenantId: decoded.tenantId || decoded.companyId || decoded.orgId || decoded.organizationId,
    orgId: decoded.orgId || decoded.organizationId || decoded.tenantId || decoded.companyId,
    workspaceId: decoded.workspaceId,
    companyCode: decoded.companyCode || null,
    avatar: freshUser?.avatar || null,
    jobTitle: freshUser?.jobTitle || null,
    department: freshUser?.department || null,
  };

  const accessToken = signSsoToken({
    sub: user.id,
    companyId: user.companyId,
    tenantId: user.tenantId,
    workspaceId: user.workspaceId || null,
    role: user.role,
    name: user.name,
    email: user.email,
    employeeId: decoded.employeeId || null,
    companyCode: user.companyCode || null,
  });

  return {
    ok: true,
    user,
    accessToken,
    cookieMaxAgeMs: ACCESS_TTL_MS,
    permissions: buildPermissionsPayload({
      role: sessionRole,
      companyId: decoded.companyId,
      workspaceId: decoded.workspaceId,
    }),
  };
}

/**
 * Set the SSO cookie on the response.
 * Call this after a successful login.
 */
export function setSSOCookie(res, accessToken) {
  const opts = buildCookieOptions(24 * 60 * 60 * 1000);
  res.cookie(LOCAL_SSO_COOKIE_NAME, accessToken, opts);
}

export function setSSOCookieWithMaxAge(res, accessToken, maxAgeMs) {
  const opts = buildCookieOptions(maxAgeMs > 0 ? maxAgeMs : 24 * 60 * 60 * 1000);
  res.cookie(LOCAL_SSO_COOKIE_NAME, accessToken, opts);
}

/**
 * Clear the SSO cookie.
 */
export function clearSSOCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  const domain = process.env.SSO_COOKIE_DOMAIN || undefined;
  res.clearCookie(LOCAL_SSO_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'None' : 'Lax',
    domain,
    path: '/',
  });
}

/**
 * GET /api/auth/me
 * Used by SSO clients to verify session and fetch identity + permissions.
 */
export async function me(req, res) {
  try {
    const session = await resolveSessionUser(req);
    if (!session.ok) {
      logAuthFailure(req, {
        reason: session.reason || 'invalid_token',
        message: session.message,
        statusCode: session.statusCode,
      });
      return res.status(session.statusCode).json({
        user: null,
        error: session.message,
        reason: session.reason || 'invalid_token',
      });
    }

    if (session.accessToken) {
      setSSOCookieWithMaxAge(res, session.accessToken, session.cookieMaxAgeMs || ACCESS_TTL_MS);
    }

    return res.status(200).json({
      user: session.user,
      permissions: session.permissions,
    });
  } catch (err) {
    console.error('[SSO /me] Unexpected error:', err);
    return res.status(500).json({ user: null, error: 'Internal server error' });
  }
}

/**
 * GET /api/auth/me/permissions
 * Returns normalized role and module-access payload for the current session.
 */
export async function mePermissions(req, res) {
  try {
    const session = await resolveSessionUser(req);
    if (!session.ok) {
      logAuthFailure(req, {
        reason: session.reason || 'invalid_token',
        message: session.message,
        statusCode: session.statusCode,
      });
      return res.status(session.statusCode).json({
        success: false,
        data: null,
        error: session.message,
        reason: session.reason || 'invalid_token',
      });
    }

    if (session.accessToken) {
      setSSOCookieWithMaxAge(res, session.accessToken, session.cookieMaxAgeMs || ACCESS_TTL_MS);
    }

    return res.status(200).json({
      success: true,
      data: session.permissions,
    });
  } catch (err) {
    console.error('[SSO /me/permissions] Unexpected error:', err);
    return res.status(500).json({ success: false, data: null, error: 'Internal server error' });
  }
}

/**
 * POST /api/auth/sso-logout
 * Clears the SSO cookie. Clients should also invalidate refresh token via
 * POST /api/v1/auth/logout.
 */
export async function ssoLogout(_req, res) {
  clearSSOCookie(res);
  return res.status(200).json({ success: true, message: 'SSO session cleared' });
}

function readSsoToken(req) {
  const bodyToken = req.body?.token || req.body?.access_token || req.body?.ssoToken || null;
  const queryToken = req.query?.token || req.query?.access_token || req.query?.ssoToken || null;
  const authHeader = String(req.headers.authorization || '');
  const [scheme, headerToken] = authHeader.split(' ');
  return bodyToken || queryToken || (scheme === 'Bearer' ? headerToken : null);
}

function readRequestContext(req) {
  return {
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
    origin: req.headers.origin || null,
    referer: req.headers.referer || null,
  };
}

function isJsonPreferred(req) {
  const accept = String(req.headers.accept || '');
  if (accept.includes('application/json')) return true;
  return req.xhr || req.method === 'POST';
}

function sanitizeReturnPath(candidate) {
  const value = String(candidate || '').trim();
  if (!value.startsWith('/')) return '/dashboard';
  if (value.startsWith('//')) return '/dashboard';
  return value;
}

function buildFrontendSsoErrorRedirect(reason) {
  const encoded = encodeURIComponent(reason || 'server_error');
  return `/sso/error?reason=${encoded}`;
}

function buildHrmsFallback(reason, returnTo) {
  const config = resolveSsoConfig();
  return buildHrmsRedirectUrl({
    reason,
    fallbackUrl: config.hrmsSsoUrl,
    returnTo: returnTo || config.tmsCallbackUrl || undefined,
  });
}

export async function ssoCallback(req, res) {
  const token = readSsoToken(req);
  const returnTo = sanitizeReturnPath(req.query.returnTo || req.body?.returnTo);

  try {
    const result = await completeSsoLogin({
      token,
      requestContext: readRequestContext(req),
      config: resolveSsoConfig(),
    });

    setSSOCookieWithMaxAge(res, result.accessToken, result.cookieMaxAgeMs);

    if (isJsonPreferred(req)) {
      return res.status(200).json({
        success: true,
        data: {
          user: result.user,
          redirectTo: returnTo,
          autoProvisioned: result.autoProvisioned,
        },
      });
    }

    return res.redirect(returnTo);
  } catch (error) {
    const reason = error?.reason || 'server_error';
    const status = error?.statusCode || 500;

    if (isJsonPreferred(req)) {
      return res.status(status).json({
        success: false,
        error: {
          reason,
          message: error.message || 'SSO callback failed',
        },
      });
    }

    if (error instanceof SSOFlowError && (reason === 'invalid_token' || reason === 'token_expired' || reason === 'missing_token')) {
      const hrmsRedirect = buildHrmsFallback(reason, resolveSsoConfig().tmsCallbackUrl || undefined);
      if (hrmsRedirect) return res.redirect(hrmsRedirect);
    }

    return res.redirect(buildFrontendSsoErrorRedirect(reason));
  }
}

export async function ssoLogoutSync(req, res) {
  const token = readSsoToken(req);
  try {
    await completeSsoLogoutSync({
      token,
      requestContext: readRequestContext(req),
      config: resolveSsoConfig(),
    });
    clearSSOCookie(res);
    return res.status(200).json({ success: true, message: 'SSO logout synced' });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: {
        reason: error?.reason || 'server_error',
        message: error?.message || 'Unable to sync logout',
      },
    });
  }
}



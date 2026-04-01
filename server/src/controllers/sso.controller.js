import { verifyAccessToken } from '../utils/jwt.js';
import { getTenantModels } from '../config/tenantDb.js';

/**
 * Build the SSO cookie options.
 * In development (non-HTTPS) we relax secure + sameSite so the cookie works
 * on localhost.  In production we enforce the secure cross-domain settings.
 */
function buildCookieOptions(maxAgeMs) {
  const isProd = process.env.NODE_ENV === 'production';
  const domain = process.env.SSO_COOKIE_DOMAIN || undefined; // e.g. ".gitakshmi.com"

  return {
    httpOnly: true,           // Not readable by JS — prevents XSS token theft
    secure: isProd,           // HTTPS-only in production
    sameSite: isProd ? 'None' : 'Lax', // 'None' required for cross-site cookies
    domain,                   // Root domain so subdomains share the cookie
    maxAge: maxAgeMs,         // milliseconds
    path: '/',
  };
}

const ACCESS_TTL_MS = parseTtlToMs(process.env.JWT_ACCESS_TTL || '8h');

function parseTtlToMs(ttl) {
  if (!ttl || typeof ttl !== 'string') return 8 * 60 * 60 * 1000;
  const m = ttl.trim().match(/^(\d+)\s*([smhdw])$/i);
  if (!m) return 8 * 60 * 60 * 1000;
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return value * (multipliers[unit] || 3600000);
}

/**
 * Set the SSO cookie on the response.
 * Call this after a successful login.
 */
export function setSSOCookie(res, accessToken) {
  const opts = buildCookieOptions(ACCESS_TTL_MS);
  res.cookie('sso_token', accessToken, opts);
}

/**
 * Clear the SSO cookie.
 */
export function clearSSOCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  const domain = process.env.SSO_COOKIE_DOMAIN || undefined;
  res.clearCookie('sso_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'None' : 'Lax',
    domain,
    path: '/',
  });
}

/**
 * GET /api/auth/me
 *
 * Used by HRMS and other consumer apps to verify the SSO session.
 * Reads the `sso_token` cookie (or Authorization header as fallback).
 *
 * Response:
 *   200  { user: { id, email, role, companyId, workspaceId, name } }
 *   401  { user: null }
 */
export async function me(req, res) {
  try {
    // Try cookie first, then Authorization header
    const cookieToken = req.cookies?.sso_token;
    const headerAuth = req.headers.authorization || '';
    const [scheme, headerToken] = headerAuth.split(' ');
    const token = cookieToken || (scheme === 'Bearer' ? headerToken : null);

    if (!token) {
      return res.status(401).json({ user: null, error: 'No session' });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ user: null, error: 'Invalid or expired session' });
    }

    // Optionally fetch fresh user data to ensure they're still active
    let freshUser = null;
    try {
      const { User } = await getTenantModels(decoded.companyId);
      freshUser = await User.findOne({
        _id: decoded.sub,
        tenantId: decoded.companyId,
        isActive: true,
      })
        .select('name email role avatar jobTitle department')
        .lean();
    } catch {
      // DB fetch failed — fall back to token data only
    }

    if (freshUser === null && freshUser !== undefined) {
      // Explicit null means user was found but condition failed
      return res.status(401).json({ user: null, error: 'User not found or inactive' });
    }

    const user = {
      id: decoded.sub,
      email: freshUser?.email || decoded.email || null,
      name: freshUser?.name || decoded.name || null,
      role: freshUser?.role || decoded.role,
      companyId: decoded.companyId,
      workspaceId: decoded.workspaceId,
      avatar: freshUser?.avatar || null,
      jobTitle: freshUser?.jobTitle || null,
      department: freshUser?.department || null,
    };

    return res.status(200).json({ user });
  } catch (err) {
    console.error('[SSO /me] Unexpected error:', err);
    return res.status(500).json({ user: null, error: 'Internal server error' });
  }
}

/**
 * POST /api/auth/sso-logout
 * Clears the SSO cookie.  Clients should also invalidate their refresh token
 * via the existing POST /api/v1/auth/logout.
 */
export async function ssoLogout(_req, res) {
  clearSSOCookie(res);
  return res.status(200).json({ success: true, message: 'SSO session cleared' });
}

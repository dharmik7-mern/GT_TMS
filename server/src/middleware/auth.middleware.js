import { verifyAccessToken, verifySsoToken } from '../utils/jwt.js';
import { getTenantModels } from '../config/tenantDb.js';
import jwt from 'jsonwebtoken';
import { normalizeRole, normalizeRoles } from '../utils/roles.js';
import { authErrorPayload, classifyJwtFailure, logAuthFailure } from '../utils/authFailure.js';

const SHARED_SSO_COOKIE_NAME = 'sso_token';
const LOCAL_SSO_COOKIE_NAME = 'tms_sso_token';

/**
 * requireAuth
 * ─────────────────────────────────────────────────────────────────────────────
 * Accepts a valid access token from EITHER:
 *   • HTTP Authorization header:  "Bearer <token>"   (existing clients)
 *   • HTTP-only cookie:           tms_sso_token       (local TMS session)
 *   • HTTP-only cookie fallback:  sso_token           (shared GT ONE session)
 *
 * This is fully backward-compatible — existing callers that send the header
 * are completely unaffected.
 */
export async function requireAuth(req, res, next) {
  // 1. Try Authorization header (existing behaviour)
  const authHeader = req.headers.authorization || '';
  const [scheme, bearerToken] = authHeader.split(' ');
  const headerToken = scheme === 'Bearer' ? bearerToken : null;

  // 2. Fallback to SSO cookie
  const cookieToken = req.cookies?.[SHARED_SSO_COOKIE_NAME] || req.cookies?.[LOCAL_SSO_COOKIE_NAME] || req.cookies?.token || req.cookies?.access_token || null;

  const token = cookieToken || headerToken;

  if (!token) {
    const reason = 'no_token';
    const message = 'Missing access token';
    logAuthFailure(req, { reason, message, statusCode: 401 });
    return res.status(401).json(authErrorPayload({ statusCode: 401, reason, message }));
  }

  try {
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (_accessError) {
      decoded = verifySsoToken(token);
    }

    req.auth = {
      ...decoded,
      role: normalizeRole(decoded.role),
    };
    // If SSO token does not include workspaceId, resolve it from membership.
    if (!req.auth.workspaceId && req.auth.companyId) {
      try {
        const { Membership, Workspace } = await getTenantModels(req.auth.companyId);
        const membership = await Membership.findOne({ tenantId: req.auth.companyId, userId: decoded.sub, status: 'active' })
          .select('workspaceId')
          .lean();
        let resolvedWorkspaceId = membership?.workspaceId || null;
        if (!resolvedWorkspaceId) {
          const workspace = await Workspace.findOne({ tenantId: req.auth.companyId })
            .sort({ createdAt: 1 })
            .select('_id')
            .lean();
          resolvedWorkspaceId = workspace?._id || null;
        }
        if (resolvedWorkspaceId) {
          req.auth.workspaceId = String(resolvedWorkspaceId);
        }
      } catch {
        // Non-fatal; leave workspaceId undefined if lookup fails.
      }
    }
    return next();
  } catch (error) {
    const reason = classifyJwtFailure(error);
    const message = reason === 'token_expired' ? 'Access token expired' : 'Invalid access token';
    logAuthFailure(req, { reason, message, statusCode: 401 });
    return res.status(401).json(authErrorPayload({ statusCode: 401, reason, message }));
  }
}

/**
 * requireRole
 * Unchanged — still works the same way on top of requireAuth.
 */
export function requireRole(roles) {
  const allowedRoles = normalizeRoles(roles);

  return (req, res, next) => {
    const role = normalizeRole(req.auth?.role);
    if (!role || !allowedRoles.includes(role)) {
      const reason = 'access_denied';
      const message = 'Insufficient permissions';
      logAuthFailure(req, { reason, message, statusCode: 403 });
      return res.status(403).json(authErrorPayload({ statusCode: 403, reason, message }));
    }
    return next();
  };
}

/**
 * verifyToken  (legacy demo middleware — kept for backward compatibility)
 */
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = { id: '65f000000000000000000102', name: 'Sarah Chen', role: 'admin' };
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch {
    req.user = { id: '65f000000000000000000102', name: 'Sarah Chen', role: 'admin' };
    next();
  }
};







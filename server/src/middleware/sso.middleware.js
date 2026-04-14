import { verifySsoToken } from '../utils/jwt.js';
import { normalizeRole } from '../utils/roles.js';
import { authErrorPayload, classifyJwtFailure, logAuthFailure } from '../utils/authFailure.js';

const SHARED_SSO_COOKIE_NAME = 'sso_token';
const LOCAL_SSO_COOKIE_NAME = 'tms_sso_token';

/**
 * SSO-aware auth middleware.
 * Reads JWT from the local TMS cookie first, then falls back to the shared GT ONE cookie.
 */
export function requireAuthSSO(req, res, next) {
  // 1. Try cookie first (SSO path)
  const cookieToken = req.cookies?.[SHARED_SSO_COOKIE_NAME] || req.cookies?.[LOCAL_SSO_COOKIE_NAME] || req.cookies?.token || req.cookies?.access_token;
  // 2. Fallback to Authorization header
  const headerAuth = req.headers.authorization || '';
  const [scheme, headerToken] = headerAuth.split(' ');
  const bearerToken = scheme === 'Bearer' ? headerToken : null;

  const token = cookieToken || bearerToken;

  if (!token) {
    const reason = 'no_token';
    const message = 'Missing access token';
    logAuthFailure(req, { reason, message, statusCode: 401 });
    return res.status(401).json(authErrorPayload({ statusCode: 401, reason, message }));
  }

  try {
    const decoded = verifySsoToken(token);
    req.auth = {
      ...decoded,
      role: normalizeRole(decoded.role),
    };
    return next();
  } catch (error) {
    const reason = classifyJwtFailure(error);
    const message = reason === 'token_expired' ? 'Access token expired' : 'Invalid access token';
    logAuthFailure(req, { reason, message, statusCode: 401 });
    return res.status(401).json(authErrorPayload({ statusCode: 401, reason, message }));
  }
}

/**
 * Optional SSO check — does NOT block the request.
 */
export function optionalAuthSSO(req, _res, next) {
  const cookieToken = req.cookies?.[SHARED_SSO_COOKIE_NAME] || req.cookies?.[LOCAL_SSO_COOKIE_NAME] || req.cookies?.token || req.cookies?.access_token;
  const headerAuth = req.headers.authorization || '';
  const [scheme, headerToken] = headerAuth.split(' ');
  const bearerToken = scheme === 'Bearer' ? headerToken : null;
  const token = cookieToken || bearerToken;

  if (token) {
    try {
      const decoded = verifySsoToken(token);
      req.auth = {
        ...decoded,
        role: normalizeRole(decoded.role),
      };
    } catch {
      // ignore
    }
  }
  return next();
}




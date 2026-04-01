import { verifyAccessToken } from '../utils/jwt.js';

/**
 * SSO-aware auth middleware.
 * Accepts token from:
 *   1. HTTP-only cookie  `sso_token`  (set by login for cross-domain SSO)
 *   2. Authorization header `Bearer <token>` (existing mobile / API clients)
 *
 * On success: attaches decoded payload to req.auth (same shape as requireAuth)
 * On failure: returns 401
 */
export function requireAuthSSO(req, res, next) {
  // 1. Try cookie first (SSO path)
  const cookieToken = req.cookies?.sso_token;
  // 2. Fallback to Authorization header (existing clients)
  const headerAuth = req.headers.authorization || '';
  const [scheme, headerToken] = headerAuth.split(' ');
  const bearerToken = scheme === 'Bearer' ? headerToken : null;

  const token = cookieToken || bearerToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing access token' },
    });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.auth = decoded;
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired access token' },
    });
  }
}

/**
 * Optional SSO check — does NOT block the request.
 * Attaches req.auth if a valid token is present, otherwise continues.
 * Use on public routes that benefit from knowing the caller's identity.
 */
export function optionalAuthSSO(req, _res, next) {
  const cookieToken = req.cookies?.sso_token;
  const headerAuth = req.headers.authorization || '';
  const [scheme, headerToken] = headerAuth.split(' ');
  const bearerToken = scheme === 'Bearer' ? headerToken : null;
  const token = cookieToken || bearerToken;

  if (token) {
    try {
      req.auth = verifyAccessToken(token);
    } catch {
      // ignore — req.auth stays undefined
    }
  }
  return next();
}

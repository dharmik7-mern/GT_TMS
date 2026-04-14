export function classifyJwtFailure(error) {
  if (error?.name === 'TokenExpiredError') {
    return 'token_expired';
  }
  return 'invalid_token';
}

export function logAuthFailure(req, { reason, message, statusCode = 401 }) {
  const source = (req.cookies?.tms_sso_token || req.cookies?.sso_token)
    ? 'cookie'
    : (req.headers.authorization ? 'authorization' : 'none');
  console.warn(
    `[auth] ${req.method} ${req.originalUrl} status=${statusCode} reason=${reason} source=${source} message="${message}"`
  );
}

export function authErrorPayload({ statusCode = 401, reason, message }) {
  const isForbidden = statusCode === 403;
  return {
    success: false,
    error: {
      code: isForbidden ? 'FORBIDDEN' : 'UNAUTHORIZED',
      reason,
      message,
    },
  };
}

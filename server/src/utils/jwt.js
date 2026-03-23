import jwt from 'jsonwebtoken';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    const err = new Error(`Missing required env: ${name}`);
    err.code = 'CONFIG_ERROR';
    err.statusCode = 500;
    throw err;
  }
  return v;
}

export function signAccessToken(payload) {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  const ttl = process.env.JWT_ACCESS_TTL || '8h';
  if (!secret) return jwt.sign(payload, 'dev_access_secret', { expiresIn: ttl });
  return jwt.sign(payload, secret, { expiresIn: ttl });
}

export function signRefreshToken(payload) {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  const ttl = process.env.JWT_REFRESH_TTL || '90d';
  if (!secret) return jwt.sign(payload, 'dev_refresh_secret', { expiresIn: ttl });
  return jwt.sign(payload, secret, { expiresIn: ttl });
}

export function verifyAccessToken(token) {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) return jwt.verify(token, 'dev_access_secret');
  return jwt.verify(token, secret);
}

export function verifyRefreshToken(token) {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) return jwt.verify(token, 'dev_refresh_secret');
  return jwt.verify(token, secret);
}


import jwt from 'jsonwebtoken';

const JWT_ALGORITHM = 'HS256';

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAudience(value) {
  const values = Array.isArray(value) ? value : parseCsv(value);
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
}

function buildSignOptions(expiresIn) {
  const opts = { algorithm: JWT_ALGORITHM, expiresIn };
  const issuer = process.env.JWT_ISSUER;
  const audience = normalizeAudience(process.env.JWT_AUDIENCE);
  if (issuer) opts.issuer = issuer;
  if (audience) opts.audience = audience;
  return opts;
}

function buildVerifyOptions({ issuer, audience } = {}) {
  const opts = { algorithms: [JWT_ALGORITHM] };
  const resolvedIssuer = issuer ?? process.env.JWT_ISSUER;
  const resolvedAudience = normalizeAudience(audience ?? process.env.JWT_AUDIENCE);
  if (resolvedIssuer) opts.issuer = resolvedIssuer;
  if (resolvedAudience) opts.audience = resolvedAudience;
  return opts;
}

function assertRequiredClaims(decoded, requiredClaims, tokenType) {
  const missing = requiredClaims.filter((claim) => {
    const value = decoded?.[claim];
    return value === undefined || value === null || value === '';
  });

  if (missing.length) {
    const err = new Error(`Invalid ${tokenType} token claims: missing ${missing.join(', ')}`);
    err.code = 'INVALID_TOKEN_CLAIMS';
    err.statusCode = 401;
    throw err;
  }
}

function verifyWithSecrets(token, secrets, options) {
  let lastError = null;
  for (const secret of secrets) {
    if (!secret) continue;
    try {
      return jwt.verify(token, secret, options);
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  throw new Error('No JWT verification secret configured');
}

function normalizeDecodedClaims(decoded) {
  const normalized = { ...decoded };
  const orgId = decoded?.orgId || decoded?.organizationId || decoded?.tenantId || decoded?.companyId || null;
  if (orgId && !normalized.companyId) normalized.companyId = orgId;
  if (orgId && !normalized.tenantId) normalized.tenantId = orgId;
  return normalized;
}

function assertPmsAccessClaims(decoded) {
  assertRequiredClaims(decoded, ['sub', 'role'], 'access');
  const hasWorkspace = Boolean(decoded?.workspaceId);
  const hasOrg = Boolean(decoded?.orgId || decoded?.organizationId || decoded?.tenantId || decoded?.companyId);
  const hasTenant = Boolean(decoded?.tenantId || decoded?.companyId);
  if (!hasWorkspace && !hasOrg && !hasTenant) {
    const err = new Error('Invalid access token claims: missing workspaceId, orgId, tenantId, or companyId');
    err.code = 'INVALID_TOKEN_CLAIMS';
    err.statusCode = 401;
    throw err;
  }
}

function resolveSsoSecret() {
  return process.env.SSO_SECRET || process.env.SSO_JWT_SECRET || process.env.JWT_SECRET || null;
}

export function signAccessToken(payload) {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  const ttl = process.env.JWT_ACCESS_TTL || '8h';
  const options = buildSignOptions(ttl);
  if (!secret) return jwt.sign(payload, 'dev_access_secret', options);
  return jwt.sign(payload, secret, options);
}

export function signSsoToken(payload) {
  const secret = resolveSsoSecret();
  const ttl = process.env.TOKEN_EXPIRY || process.env.JWT_ACCESS_TTL || '8h';
  const options = buildSignOptions(ttl);
  if (!secret) return jwt.sign(payload, 'dev_sso_secret', options);
  return jwt.sign(payload, secret, options);
}

export function signRefreshToken(payload) {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  const ttl = process.env.JWT_REFRESH_TTL || '90d';
  const options = buildSignOptions(ttl);
  if (!secret) return jwt.sign(payload, 'dev_refresh_secret', options);
  return jwt.sign(payload, secret, options);
}

export function verifyAccessToken(token) {
  const options = buildVerifyOptions();
  const secrets = [
    process.env.SSO_SECRET || null,
    process.env.JWT_ACCESS_SECRET || null,
    process.env.JWT_SECRET || null,
    process.env.SSO_JWT_SECRET || null,
    'dev_access_secret',
  ];
  const decoded = normalizeDecodedClaims(verifyWithSecrets(token, secrets, options));
  assertPmsAccessClaims(decoded);
  return decoded;
}

export function verifySsoToken(token) {
  const ssoAudiences = Array.from(new Set([
    ...parseCsv(process.env.SSO_EXPECTED_AUDIENCE),
    ...parseCsv(process.env.JWT_AUDIENCE),
    'sso',
  ]));
  const options = buildVerifyOptions({
    issuer: process.env.SSO_EXPECTED_ISSUER || process.env.JWT_ISSUER,
    audience: ssoAudiences,
  });
  const secrets = [
    process.env.SSO_SECRET || null,
    process.env.SSO_JWT_SECRET || null,
    process.env.JWT_SECRET || null,
    process.env.JWT_ACCESS_SECRET || null,
    'dev_sso_secret',
    'dev_access_secret',
  ];
  const decoded = normalizeDecodedClaims(verifyWithSecrets(token, secrets, options));
  assertPmsAccessClaims(decoded);
  return decoded;
}

export function verifyRefreshToken(token) {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  const options = buildVerifyOptions();
  const decoded = !secret
    ? jwt.verify(token, 'dev_refresh_secret', options)
    : jwt.verify(token, secret, options);

  assertRequiredClaims(decoded, ['sub', 'companyId'], 'refresh');
  return decoded;
}


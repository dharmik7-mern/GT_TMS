import { authDebug } from './authDebug';

export type ParsedJwtPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  role?: string;
  workspaceId?: string;
  orgId?: string;
  organizationId?: string;
  companyId?: string;
  [key: string]: unknown;
};

const CURRENT_APP = String(import.meta.env.VITE_SSO_APP || 'pms').trim().toLowerCase();

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return atob(padded);
}

export function parseJwtPayload(token: string): ParsedJwtPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(decodeBase64Url(parts[1])) as ParsedJwtPayload;
  } catch {
    return null;
  }
}

function hasExpectedAudience(aud: ParsedJwtPayload['aud'], expectedAudience: string) {
  if (!expectedAudience) return true;
  if (Array.isArray(aud)) {
    return aud.includes(expectedAudience);
  }
  return String(aud || '') === expectedAudience;
}

export function validateSsoTokenClaims(token: string, options?: { expectedIssuer?: string; expectedAudience?: string }) {
  const payload = parseJwtPayload(token);
  if (!payload) {
    return { valid: false, reason: 'invalid_token_payload', payload: null as ParsedJwtPayload | null };
  }

  const expectedIssuer = String(options?.expectedIssuer || import.meta.env.VITE_SSO_EXPECTED_ISS || '').trim();
  const expectedAudience = String(options?.expectedAudience || import.meta.env.VITE_SSO_EXPECTED_AUD || '').trim();

  if (expectedIssuer && payload.iss !== expectedIssuer) {
    return { valid: false, reason: 'invalid_issuer', payload };
  }
  if (expectedAudience && !hasExpectedAudience(payload.aud, expectedAudience)) {
    authDebug('warn', 'app_mismatch_detected', {
      app: CURRENT_APP,
      expectedAudience,
      tokenAudience: payload.aud || null,
      reason: 'invalid_audience',
    });
    return { valid: false, reason: 'invalid_audience', payload };
  }

  if (typeof payload.exp === 'number' && Date.now() >= payload.exp * 1000) {
    return { valid: false, reason: 'token_expired', payload };
  }

  return { valid: true, reason: null, payload };
}

export function hasRequiredContextClaims(payload: ParsedJwtPayload | null | undefined) {
  const role = String(payload?.role || '').trim();
  const tenantId = String((payload as any)?.tenantId || payload?.companyId || payload?.orgId || payload?.organizationId || '').trim();
  const workspaceId = String(payload?.workspaceId || '').trim();
  const orgId = String(payload?.orgId || payload?.organizationId || payload?.companyId || '').trim();
  if (CURRENT_APP === 'hrms') {
    return Boolean(role && tenantId);
  }
  return Boolean(role && workspaceId && orgId);
}

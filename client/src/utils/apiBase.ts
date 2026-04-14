function stripApiSuffix(value: string) {
  return value.replace(/\/api(?:\/v1)?\/?$/i, '');
}

function collapseSlashes(value: string) {
  return value.replace(/\/{2,}/g, '/');
}

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function normalizeConfiguredBase(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  if (/\/api\/v1$/i.test(trimmed)) return trimmed;
  if (/\/api$/i.test(trimmed)) return `${trimmed}/v1`;
  return `${trimmed}/api/v1`;
}

export function resolveApiV1Base() {
  const configured = normalizeConfiguredBase(String(import.meta.env.VITE_API_URL || ''));
  if (configured) return configured;
  if (typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location.hostname)) {
    return `http://${window.location.hostname}:5002/api/v1`;
  }
  return '/api/v1';
}

export function normalizeApiPath(path: string) {
  const raw = String(path || '').trim();
  if (!raw || isAbsoluteUrl(raw)) return raw;
  const prefixed = raw.startsWith('/') ? raw : `/${raw}`;
  const withoutApiPrefix = prefixed.replace(/^\/api(?:\/v1)?/i, '');
  const normalized = collapseSlashes(withoutApiPrefix || '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export function resolveApiRoot() {
  return stripApiSuffix(resolveApiV1Base());
}

export function resolveSsoMeUrl() {
  return `${resolveApiRoot()}/api/auth/sso/me`;
}

export function resolveBrowserHostname() {
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
}

export function resolveGtOneBase() {
  const configured = String(import.meta.env.VITE_GT_ONE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  return `http://${resolveBrowserHostname()}:5174`;
}

export function resolveCurrentAppDashboardUrl() {
  if (typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}/dashboard`;
  }
  return `http://${resolveBrowserHostname()}:5173/dashboard`;
}

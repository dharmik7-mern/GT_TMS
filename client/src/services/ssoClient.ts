import type { Role } from '../app/types';
import { mapGtOneRole } from '../utils/roleMapping';
import { resolveSsoMeUrl } from '../utils/apiBase';
import { authDebug } from '../utils/authDebug';

type SSOUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  companyId?: string | null;
  tenantId?: string | null;
  companyCode?: string | null;
  orgId?: string | null;
  workspaceId?: string | null;
  avatar?: string | null;
  jobTitle?: string | null;
  department?: string | null;
};

type SSOPermissions = {
  role: Role;
  modules: string[];
  tenant: {
    companyId: string;
    workspaceId: string;
  };
};

export type SSOSession = {
  user: SSOUser;
  permissions: SSOPermissions | null;
};

const SSO_ME_TTL_MS = 15000;
const MAX_RETRIES = 0;
const REQUEST_COOLDOWN_MS = 15000;

let cache: { value: SSOSession | null; expiresAt: number } | null = null;
let inflight: Promise<SSOSession | null> | null = null;
let lastAttemptAt = 0;
let cooldownUntil = 0;
let lastSessionErrorCode: string | null = null;

const SSO_ME_URL = resolveSsoMeUrl();
const SSO_CONTEXT_URL = String(import.meta.env.VITE_SSO_SESSION_ME_URL || '').trim();
const CURRENT_APP = String(import.meta.env.VITE_SSO_APP || 'pms').trim().toLowerCase();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientStatus(status: number) {
  return status === 408 || (status >= 500 && status < 600);
}

function normalizeSessionPayload(raw: any): SSOSession | null {
  const payload = raw?.data ? raw.data : raw;
  if (!payload?.user?.id) return null;
  const mappedRole = mapGtOneRole(payload?.user?.role || payload?.permissions?.role);
  const resolvedOrgId = String(payload.user?.orgId || payload.user?.organizationId || payload.user?.companyId || payload.permissions?.tenant?.companyId || '').trim();
  const resolvedWorkspaceId = String(payload.user?.workspaceId || payload.permissions?.tenant?.workspaceId || '').trim();

  return {
    user: {
      ...payload.user,
      role: mappedRole,
      orgId: resolvedOrgId || null,
      companyId: String(payload.user?.companyId || resolvedOrgId || '').trim() || null,
      tenantId: String(payload.user?.tenantId || payload.user?.companyId || resolvedOrgId || '').trim() || null,
      companyCode: String(payload.user?.companyCode || payload.permissions?.tenant?.companyCode || '').trim() || null,
      workspaceId: resolvedWorkspaceId || null,
    },
    permissions: payload?.permissions
      ? {
          role: mapGtOneRole(payload.permissions.role),
          modules: Array.isArray(payload.permissions.modules) ? payload.permissions.modules : [],
          tenant: {
            companyId: String(payload.permissions?.tenant?.companyId || payload.user?.companyId || resolvedOrgId || ''),
            workspaceId: String(payload.permissions?.tenant?.workspaceId || payload.user?.workspaceId || resolvedWorkspaceId || ''),
          },
        }
      : null,
  };
}

function hasRequiredSessionClaims(session: SSOSession | null) {
  const role = String(session?.user?.role || session?.permissions?.role || '').trim();
  const workspaceId = String(session?.user?.workspaceId || session?.permissions?.tenant?.workspaceId || '').trim();
  const orgId = String(session?.user?.orgId || session?.user?.tenantId || session?.user?.companyId || session?.permissions?.tenant?.companyId || '').trim();
  const tenantId = String(session?.user?.tenantId || session?.user?.companyId || session?.permissions?.tenant?.companyId || '').trim();
  if (CURRENT_APP === 'hrms') {
    return Boolean(role && tenantId);
  }
  return Boolean(role && workspaceId && orgId);
}

function parseRetryAfterMs(response: Response) {
  const header = response.headers.get('retry-after');
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }
  return REQUEST_COOLDOWN_MS;
}

async function requestSessionFromUrl(url: string, accessToken?: string | null): Promise<SSOSession | null> {
  const now = Date.now();
  if (now < cooldownUntil) {
    lastSessionErrorCode = 'rate_limited';
    authDebug('warn', 'rate_limited', { app: CURRENT_APP, source: 'cooldown', waitMs: cooldownUntil - now });
    return null;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    try {
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers,
      });
      const body = await res.clone().json().catch(() => null);
      const reasonFromBody = String(body?.reason || body?.error?.reason || '').trim() || null;

      if (res.ok) {
        lastSessionErrorCode = null;
        return normalizeSessionPayload(body);
      }

      if (res.status === 429) {
        lastSessionErrorCode = 'rate_limited';
        cooldownUntil = Date.now() + parseRetryAfterMs(res);
        authDebug('warn', 'rate_limited', { app: CURRENT_APP, source: 'session_http', url, status: res.status, cooldownUntil });
        return null;
      }

      if (res.status === 401 || res.status === 403) {
        lastSessionErrorCode = reasonFromBody || (res.status === 401 ? 'no_token' : 'access_denied');
        authDebug('warn', lastSessionErrorCode, { app: CURRENT_APP, source: 'session_http_unauthorized', url, status: res.status });
        return null;
      }

      if (!isTransientStatus(res.status) || attempt === MAX_RETRIES) return null;
    } catch (error) {
      authDebug('warn', 'session_http_error', { url, attempt, error: String(error) });
      if (attempt === MAX_RETRIES) return null;
    }

    const waitMs = Math.min(300 * (2 ** attempt), 2000);
    await delay(waitMs);
  }

  return null;
}

function buildContextUrl(callbackCode?: string | null) {
  if (!SSO_CONTEXT_URL) return null;
  try {
    const url = new URL(SSO_CONTEXT_URL, window.location.origin);
    const configuredApp = String(url.searchParams.get('app') || '').trim().toLowerCase();
    if (configuredApp && configuredApp !== CURRENT_APP) {
      authDebug('warn', 'app_mismatch_detected', {
        expectedApp: CURRENT_APP,
        configuredApp,
        source: 'sso_session_me_url',
      });
    }
    url.searchParams.set('app', CURRENT_APP);
    if (callbackCode) {
      url.searchParams.set('code', callbackCode);
    } else {
      url.searchParams.delete('code');
    }
    return url.toString();
  } catch {
    const separator = SSO_CONTEXT_URL.includes('?') ? '&' : '?';
    const withoutExistingApp = SSO_CONTEXT_URL.replace(/([?&])app=[^&]*(&?)/i, (_m, lead, tail) => (tail ? lead : ''));
    const withApp = `${withoutExistingApp}${withoutExistingApp.includes('?') ? '&' : separator}app=${encodeURIComponent(CURRENT_APP)}`;
    if (!callbackCode) return withApp;
    const codeSeparator = withApp.includes('?') ? '&' : '?';
    return `${withApp}${codeSeparator}code=${encodeURIComponent(callbackCode)}`;
  }
}

export async function getSSOSession(options?: { force?: boolean; accessToken?: string | null; callbackCode?: string | null; requireContext?: boolean }) {
  const force = Boolean(options?.force);
  const accessToken = options?.accessToken || null;
  const callbackCode = options?.callbackCode || null;
  const requireContext = options?.requireContext !== false;
  const now = Date.now();

  if (!force && cache && cache.expiresAt > now) {
    return cache.value;
  }

  if (inflight) return inflight;
  if (now - lastAttemptAt < REQUEST_COOLDOWN_MS && !force) {
    return cache?.value ?? null;
  }
  lastAttemptAt = now;

  inflight = requestSessionFromUrl(SSO_ME_URL, accessToken)
    .then(async (session) => {
      if (!requireContext || hasRequiredSessionClaims(session)) {
        cache = { value: session, expiresAt: Date.now() + SSO_ME_TTL_MS };
        return session;
      }

      authDebug('warn', 'session_missing_context_claims', {
        app: CURRENT_APP,
        hasRole: Boolean(session?.user?.role || session?.permissions?.role),
        hasWorkspaceId: Boolean(session?.user?.workspaceId || session?.permissions?.tenant?.workspaceId),
        hasOrgId: Boolean(session?.user?.orgId || session?.user?.tenantId || session?.user?.companyId || session?.permissions?.tenant?.companyId),
        hasTenantId: Boolean(session?.user?.tenantId || session?.user?.companyId || session?.permissions?.tenant?.companyId),
        hasCompanyCode: Boolean(session?.user?.companyCode),
      });
      authDebug('warn', 'session_app_context_missing', {
        app: CURRENT_APP,
        hasRole: Boolean(session?.user?.role || session?.permissions?.role),
        hasWorkspaceId: Boolean(session?.user?.workspaceId || session?.permissions?.tenant?.workspaceId),
        hasOrgId: Boolean(session?.user?.orgId || session?.user?.tenantId || session?.user?.companyId || session?.permissions?.tenant?.companyId),
        hasTenantId: Boolean(session?.user?.tenantId || session?.user?.companyId || session?.permissions?.tenant?.companyId),
        hasCompanyCode: Boolean(session?.user?.companyCode),
      });

      const fallbackUrl = buildContextUrl(callbackCode);
      if (!fallbackUrl) {
        cache = { value: session, expiresAt: Date.now() + SSO_ME_TTL_MS };
        return session;
      }

      // Hydrate context from SSO endpoint once.
      const hydrated = await requestSessionFromUrl(fallbackUrl, accessToken);

      // Re-validate session once after hydration.
      const revalidated = hydrated ? await requestSessionFromUrl(SSO_ME_URL, accessToken) : null;
      const resolved = revalidated || hydrated || session;
      cache = { value: resolved, expiresAt: Date.now() + SSO_ME_TTL_MS };
      return resolved;
    })
    .then((session) => {
      cache = { value: session, expiresAt: Date.now() + SSO_ME_TTL_MS };
      return session;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function clearSSOSessionCache() {
  cache = null;
}

export function getSSOSessionErrorCode() {
  return lastSessionErrorCode;
}

export function clearSSOSessionError() {
  lastSessionErrorCode = null;
}

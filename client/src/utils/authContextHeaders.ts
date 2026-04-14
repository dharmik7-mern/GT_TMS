import { AUTH_STORAGE_KEY } from '../auth/authSession';

type PersistedUser = {
  workspaceId?: string;
  companyId?: string;
  orgId?: string;
  organizationId?: string;
};

export function readPersistedAuthState() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { token: null as string | null, user: null as PersistedUser | null };
    const parsed = JSON.parse(raw);
    const state = parsed?.state || parsed;
    const token = typeof state?.token === 'string' ? state.token : null;
    const user = (state?.user || null) as PersistedUser | null;
    return { token, user };
  } catch {
    return { token: null as string | null, user: null as PersistedUser | null };
  }
}

export function getContextHeaders(user?: PersistedUser | null) {
  const workspaceId = String(user?.workspaceId || '').trim();
  const orgId = String(user?.orgId || user?.organizationId || user?.companyId || '').trim();
  if (workspaceId) {
    return { 'X-Workspace-ID': workspaceId };
  }
  if (orgId) {
    return { 'X-Org-ID': orgId };
  }
  return {};
}

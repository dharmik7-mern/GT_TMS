/**
 * useSSO — React hook that validates the SSO session on mount.
 *
 * Behaviour:
 *  • On every app load, calls GET /api/auth/me (with credentials: 'include'
 *    so the sso_token cookie is sent automatically).
 *  • If a valid session exists → hydrates authStore (user + token) so the UI
 *    knows who is logged in without a fresh password entry.
 *  • If no valid session → lets the app continue normally (the router /
 *    RequireAuth guard will redirect to /login if needed).
 *
 * This hook is designed to be called ONCE in the root <App /> component.
 */

import { useEffect, useRef } from 'react';
import { useAuthStore } from '../context/authStore';

const SSO_ME_URL = (() => {
  // In dev the frontend runs on :5173 and the backend on :5000
  const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
  // /api/auth is mounted at root level (not versioned), so derive base
  const base = apiBase.replace(/\/api\/v1\/?$/, '');
  return `${base}/api/auth/me`;
})();

export function useSSO() {
  const { isAuthenticated, user, token, login: _login, ...store } = useAuthStore();
  // We only hydrate once per page load
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    // If already authenticated (e.g. from persisted localStorage), skip
    if (isAuthenticated && user && token) return;

    // Check SSO session silently
    fetch(SSO_ME_URL, {
      method: 'GET',
      credentials: 'include',   // ← sends the sso_token cookie cross-origin
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.user) {
          // SSO session is valid — update the store so the UI reflects the user
          // We don't have a fresh JWT string here (it's httpOnly), but we can
          // mark the user as authenticated for UI purposes. API calls will work
          // via the cookie automatically (withCredentials on axios).
          useAuthStore.setState({
            user: {
              id: data.user.id,
              name: data.user.name || '',
              email: data.user.email || '',
              role: data.user.role,
              avatar: data.user.avatar || undefined,
              jobTitle: data.user.jobTitle || undefined,
              department: data.user.department || undefined,
              workspaceId: data.user.workspaceId || '',
              isActive: true,
              canUsePrivateQuickTasks: false,
              color: '',
              createdAt: new Date().toISOString(),
              preferences: undefined,
              bio: undefined,
            },
            isAuthenticated: true,
            // token stays null — API calls use the cookie
          });
        }
      })
      .catch(() => {
        // Network error or server unreachable — silently ignore
      });
  }, [isAuthenticated, user, token]);
}

/**
 * Helper used by HRMS (or any consumer app):
 *
 *   import { checkSSOSession } from '@/hooks/useSSO';
 *   const user = await checkSSOSession('https://projects.gitakshmi.com');
 *
 * Returns the user object if authenticated, or null.
 */
export async function checkSSOSession(pmsOrigin = '') {
  try {
    const url = `${pmsOrigin}/api/auth/me`;
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.user || null;
  } catch {
    return null;
  }
}

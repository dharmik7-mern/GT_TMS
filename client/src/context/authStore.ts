import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../app/types';
import { authService } from '../services/api';

interface LoginPayload {
  email?: string;
  companyCode?: string;
  employeeCode?: string;
  password: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<{ success: boolean; error?: string }>;
  refresh: () => Promise<boolean>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (payload: LoginPayload) => {
        set({ isLoading: true });
        try {
          const res = await authService.login(payload);
          const { token, refreshToken, user } = res.data.data;

          // The backend now also sets the SSO cookie (httpOnly) automatically.
          // We still persist token + user in localStorage for offline-resilience.
          set({ user, token, refreshToken, isAuthenticated: true, isLoading: false });

          // ── SSO redirect support ─────────────────────────────────────────
          // If the user was sent here from another app (e.g. HRMS), redirect back.
          const params = new URLSearchParams(window.location.search);
          const redirectTo = params.get('redirect');
          if (redirectTo) {
            // Brief timeout lets the store persist before navigating away
            setTimeout(() => {
              window.location.href = decodeURIComponent(redirectTo);
            }, 100);
          }
          // ─────────────────────────────────────────────────────────────────

          return { success: true };
        } catch (e: any) {
          set({ isLoading: false });
          const msg =
            e?.response?.data?.error?.message ||
            e?.response?.data?.message ||
            'Login failed';
          return { success: false, error: msg };
        }
      },

      refresh: async () => {
        const rt = get().refreshToken;
        if (!rt) return false;
        try {
          const res = await authService.refresh(rt);
          const { token, refreshToken, user } = res.data.data;
          // The backend also rotates the SSO cookie on refresh
          set({ token, refreshToken, user, isAuthenticated: true });
          return true;
        } catch {
          set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
          return false;
        }
      },

      logout: () => {
        const rt = get().refreshToken;
        // Fire-and-forget: server clears refresh token record AND SSO cookie
        authService.logout(rt).catch(() => { });
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
      },

      updateUser: (updates) => {
        const current = get().user;
        if (current) {
          set({ user: { ...current, ...updates } });
        }
      },
    }),
    {
      name: 'flowboard-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

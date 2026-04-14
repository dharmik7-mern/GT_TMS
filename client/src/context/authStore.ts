import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../app/types';
import { authService } from '../services/api';
import { applyAuthHeader, clearPersistedAuthSession, publishLogoutSyncEvent } from '../auth/authSession';
import { resolveGtOneBase } from '../utils/apiBase';

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
  setUser: (user: User | null) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
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

          applyAuthHeader(token || null);
          set({ user, token, refreshToken, isAuthenticated: true, isLoading: false });

          const params = new URLSearchParams(window.location.search);
          const redirectTo = params.get('redirect');
          if (redirectTo) {
            setTimeout(() => {
              window.location.href = decodeURIComponent(redirectTo);
            }, 100);
          }

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
          applyAuthHeader(token || null);
          set({ token, refreshToken, user, isAuthenticated: true });
          return true;
        } catch {
          applyAuthHeader(null);
          set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
          return false;
        }
      },

      logout: () => {
        const rt = get().refreshToken;
        Promise.resolve(authService.logout(rt)).catch(() => {});
        clearPersistedAuthSession();
        publishLogoutSyncEvent();
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
        const gtOneBase = resolveGtOneBase();
        window.location.href = `${gtOneBase}/logout?redirect=${encodeURIComponent(`${gtOneBase}/login`)}`;
      },

      updateUser: (updates) => {
        const current = get().user;
        if (current) {
          set({ user: { ...current, ...updates } });
        }
      },

      setUser: (user) => set({ user }),
      setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
    }),
    {
      name: 'flowboard-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

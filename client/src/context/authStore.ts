import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Role } from '../app/types';
import { authService } from '../services/api';

interface AuthStore {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, role?: Role) => Promise<{ success: boolean; error?: string }>;
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

      login: async (email: string, _password: string, role?: Role) => {
        set({ isLoading: true });
        try {
          // role is only used by the demo role buttons to prefill email;
          // backend determines actual role from the user record.
          const res = await authService.login(email, _password);
          const { token, refreshToken, user } = res.data.data;
          set({ user, token, refreshToken, isAuthenticated: true, isLoading: false });
          return { success: true };
        } catch (e: any) {
          set({ isLoading: false });
          const msg = e?.response?.data?.error?.message || e?.response?.data?.message || 'Login failed';
          return { success: false, error: msg };
        }
      },

      refresh: async () => {
        const rt = get().refreshToken;
        if (!rt) return false;
        try {
          const res = await authService.refresh(rt);
          const { token, refreshToken, user } = res.data.data;
          set({ token, refreshToken, user, isAuthenticated: true });
          return true;
        } catch {
          set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
          return false;
        }
      },

      logout: () => {
        const rt = get().refreshToken;
        // fire and forget
        authService.logout(rt).catch(() => {});
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
      partialize: (state) => ({ user: state.user, token: state.token, refreshToken: state.refreshToken, isAuthenticated: state.isAuthenticated }),
    }
  )
);

import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";
import { getSSOUser } from "../auth/authSession";
import { clearSSOSessionError, getSSOSession } from "../services/ssoClient";
import { useAuthStore } from "./authStore";
import { resolveCurrentAppDashboardUrl, resolveGtOneBase } from "../utils/apiBase";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  companyId?: string;
  workspaceId?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  isBootstrapped: boolean;
  isRecoveringContext: boolean;
  hasTriedContextRecovery: boolean;
  authErrorCode: string | null;
  authErrorMessage: string | null;
  recoverMissingContext: () => Promise<void>;
  setUser: (user: User | null) => void;
  setIsAuthenticated: (auth: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const setStoreUser = useAuthStore((state) => state.setUser);
  const setStoreIsAuthenticated = useAuthStore((state) => state.setIsAuthenticated);

  useEffect(() => {
    const checkSSO = async () => {
      try {
        clearSSOSessionError();
        const session = await getSSOSession({ force: true, requireContext: false });
        const data = session?.user ? { user: session.user } : await getSSOUser();
        if (data && data.user) {
          setUser(data.user);
          setIsAuthenticated(true);
          setStoreUser(data.user);
          setStoreIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
          setStoreUser(null);
          setStoreIsAuthenticated(false);
        }
      } catch (error) {
        setUser(null);
        setIsAuthenticated(false);
        setStoreUser(null);
        setStoreIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkSSO();
  }, [setStoreIsAuthenticated, setStoreUser]);

  const logout = async () => {
    try {
      await api.post("/auth/sso-logout");
      setUser(null);
      setIsAuthenticated(false);
      setStoreUser(null);
      setStoreIsAuthenticated(false);
      window.location.href = `${resolveGtOneBase()}/login?redirect=${encodeURIComponent(resolveCurrentAppDashboardUrl())}`;
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const recoverMissingContext = async () => {
    try {
      const data = await getSSOUser();
      if (data && data.user) {
        setUser(data.user);
        setIsAuthenticated(true);
        setStoreUser(data.user);
        setStoreIsAuthenticated(true);
      }
    } catch (_error) {
      // best effort
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        isBootstrapped: !loading,
        isRecoveringContext: false,
        hasTriedContextRecovery: !loading,
        authErrorCode: null,
        authErrorMessage: null,
        recoverMissingContext,
        setUser,
        setIsAuthenticated,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const useAuthContext = useAuth;

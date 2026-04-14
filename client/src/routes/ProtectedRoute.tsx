import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '../app/types';
import { useAuthStore } from '../context/authStore';
import { useAuthContext } from '../context/AuthContext';
import { mapGtOneRole } from '../utils/roleMapping';
import { authDebug } from '../utils/authDebug';
const CURRENT_APP = String(import.meta.env.VITE_SSO_APP || 'pms').trim().toLowerCase();
const SSO_LOGIN_URL = (() => {
  const configured = String(import.meta.env.VITE_SSO_LOGIN_URL || '').trim();
  if (configured) return configured;
  const sessionMeUrl = String(import.meta.env.VITE_SSO_SESSION_ME_URL || '').trim();
  if (!sessionMeUrl) return '';
  try {
    const parsed = new URL(sessionMeUrl);
    return `${parsed.origin}/login`;
  } catch {
    return '';
  }
})();

type ProtectedRouteProps = {
  children: React.ReactNode;
  roles?: Role[];
  requireTenant?: boolean;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles, requireTenant = false }) => {
  const location = useLocation();
  const { isBootstrapped, isRecoveringContext, hasTriedContextRecovery, authErrorCode, authErrorMessage, recoverMissingContext } = useAuthContext();
  const { isAuthenticated, user } = useAuthStore();
  const recoveryRequestedRef = useRef(false);

  const isMissingTenantContext = Boolean(
    requireTenant && user && (
      CURRENT_APP === 'hrms'
        ? (!(user as any).tenantId && !user.companyId)
        : (!user.companyId || !user.workspaceId)
    )
  );

  useEffect(() => {
    if (!isBootstrapped) return;
    if (isAuthenticated && user) {
      return;
    }
    if (!SSO_LOGIN_URL) return;
    const currentUrl = `${window.location.origin}${location.pathname}${location.search}${location.hash}`;
    const separator = SSO_LOGIN_URL.includes('?') ? '&' : '?';
    const target = `${SSO_LOGIN_URL}${separator}redirect=${encodeURIComponent(currentUrl)}&app=${encodeURIComponent(CURRENT_APP)}`;
    authDebug('info', 'sso_redirect_target', { app: CURRENT_APP, source: 'protected_route_manual', target });
  }, [isBootstrapped, isAuthenticated, user, location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!isBootstrapped || !isAuthenticated || !user || !requireTenant) return;
    if (!isMissingTenantContext) {
      recoveryRequestedRef.current = false;
      return;
    }
    if (isRecoveringContext) return;
    if (authErrorCode === 'rate_limited') return;
    if (recoveryRequestedRef.current) return;

    recoveryRequestedRef.current = true;
    authDebug('warn', 'tenant_missing', {
      app: CURRENT_APP,
      path: location.pathname,
      companyId: user.companyId || null,
      workspaceId: user.workspaceId || null,
      tenantId: (user as any).tenantId || user.companyId || null,
      companyCode: (user as any).companyCode || null,
    });
    void recoverMissingContext();
  }, [
    isBootstrapped,
    isAuthenticated,
    user,
    requireTenant,
    isMissingTenantContext,
    isRecoveringContext,
    authErrorCode,
    location.pathname,
    recoverMissingContext,
  ]);

  if (!isBootstrapped) return null;

  if (!isAuthenticated || !user) {
    const currentUrl = `${window.location.origin}${location.pathname}${location.search}${location.hash}`;
    const separator = SSO_LOGIN_URL.includes('?') ? '&' : '?';
    const target = `${SSO_LOGIN_URL}${separator}redirect=${encodeURIComponent(currentUrl)}&app=${encodeURIComponent(CURRENT_APP)}`;
    return (
      <div className="p-6 text-sm text-surface-600">
        <p className="mb-3">Auto-refresh stop kari didhu chhe. TMS authenticated session mali nathi.</p>
        {SSO_LOGIN_URL ? (
          <a href={target} className="text-brand-600 underline">
            Open GT ONE Login
          </a>
        ) : (
          <p className="text-rose-600">SSO login URL configured nathi.</p>
        )}
      </div>
    );
  }

  if (isMissingTenantContext) {
    if (authErrorCode === 'rate_limited') {
      return (
        <div className="p-6 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl">
          {authErrorMessage || 'Server busy, retry after a few seconds.'}
        </div>
      );
    }

    if (isRecoveringContext || !hasTriedContextRecovery) {
      return (
        <div className="p-6 text-sm text-surface-500">
          Recovering your workspace context...
        </div>
      );
    }

    return <Navigate to="/unauthorized" replace />;
  }

  if (roles?.length) {
    const mappedUserRole = mapGtOneRole(user.role);
    const mappedAllowedRoles = roles.map((role) => mapGtOneRole(role));
    if (!mappedAllowedRoles.includes(mappedUserRole)) {
      return <Navigate to="/access-denied" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;

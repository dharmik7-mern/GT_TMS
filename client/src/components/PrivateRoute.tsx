import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { resolveCurrentAppDashboardUrl, resolveGtOneBase } from "../utils/apiBase";

interface PrivateRouteProps {
  children: React.ReactNode;
  roles?: string[];
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, roles }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const ssoLoginUrl = `${resolveGtOneBase()}/login`;
  const redirectTarget = resolveCurrentAppDashboardUrl();
  const redirectParam = encodeURIComponent(redirectTarget);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-50 dark:bg-surface-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
        <span className="ml-4 text-surface-600">Verifying session...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white font-sans p-6 text-center">
        <div className="bg-[#1e293b] p-10 rounded-2xl shadow-2xl border border-white/10 max-w-sm w-full animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Session Required</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Tamari session expire thai gai che. Please GT ONE ma login karo.
          </p>
          <a
            href={`${ssoLoginUrl}?redirect=${redirectParam}`}
            className="block w-full py-3.5 bg-blue-600 hover:bg-blue-500 transition-colors rounded-xl font-semibold shadow-lg shadow-blue-500/20 active:scale-95 duration-200"
          >
            Login to GT ONE
          </a>
        </div>
      </div>
    );
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default PrivateRoute;

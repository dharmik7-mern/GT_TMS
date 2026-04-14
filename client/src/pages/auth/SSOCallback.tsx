import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/api';
import { useAuthStore } from '../../context/authStore';

function readTokenFromLocation() {
  const url = new URL(window.location.href);
  return (
    url.searchParams.get('token') ||
    url.searchParams.get('access_token') ||
    url.searchParams.get('ssoToken') ||
    null
  );
}

function readReturnTo() {
  const url = new URL(window.location.href);
  const value = url.searchParams.get('returnTo') || '/dashboard';
  if (!value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

const SSOCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const token = useMemo(() => readTokenFromLocation(), []);
  const returnTo = useMemo(() => readReturnTo(), []);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        if (!token) {
          navigate('/sso/error?reason=missing_token', { replace: true });
          return;
        }

        await authService.ssoCallback({ token, returnTo });
        const session = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }).then((res) => (res.ok ? res.json() : null));

        if (!alive) return;
        if (!session?.user?.id) {
          navigate('/sso/error?reason=no_active_session', { replace: true });
          return;
        }

        useAuthStore.setState({
          user: {
            id: session.user.id,
            name: session.user.name || '',
            email: session.user.email || '',
            role: session.user.role,
            avatar: session.user.avatar || undefined,
            jobTitle: session.user.jobTitle || undefined,
            department: session.user.department || undefined,
            workspaceId: session.user.workspaceId || '',
            companyId: session.user.companyId || '',
            isActive: true,
            canUsePrivateQuickTasks: false,
            color: '',
            createdAt: new Date().toISOString(),
            preferences: undefined,
            bio: undefined,
          },
          token: null,
          refreshToken: null,
          isAuthenticated: true,
        });

        navigate(returnTo, { replace: true });
      } catch (error: any) {
        if (!alive) return;
        const reason = String(error?.response?.data?.error?.reason || 'server_error');
        navigate(`/sso/error?reason=${encodeURIComponent(reason)}`, { replace: true });
      }
    };

    run().catch((error) => {
      if (!alive) return;
      setErrorMessage(error?.message || 'Unable to complete SSO callback.');
    });

    return () => {
      alive = false;
    };
  }, [navigate, returnTo, token]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-surface-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-surface-900">Signing You In</h1>
        <p className="mt-2 text-sm text-surface-600">
          Please wait while we securely complete your single sign-on.
        </p>
        {errorMessage ? (
          <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</p>
        ) : null}
      </div>
    </div>
  );
};

export default SSOCallbackPage;

import React, { useMemo } from 'react';

const SSO_LOGIN_URL = String(import.meta.env.VITE_SSO_LOGIN_URL || '').trim();

const reasonMessageMap: Record<string, string> = {
  token_expired: 'Your SSO link expired. Please sign in again from HRMS.',
  invalid_token: 'The SSO token is invalid. Please retry from HRMS.',
  missing_token: 'No SSO token was received. Please start login from HRMS.',
  untrusted_domain: 'The login request came from an untrusted domain.',
  server_error: 'A server issue occurred while signing you in.',
};

function readReason() {
  const url = new URL(window.location.href);
  return String(url.searchParams.get('reason') || 'server_error').trim();
}

const SSOErrorPage: React.FC = () => {
  const reason = useMemo(() => readReason(), []);
  const message = reasonMessageMap[reason] || reasonMessageMap.server_error;

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6">
      <div className="max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <h1 className="text-xl font-semibold text-rose-800">Single Sign-On Failed</h1>
        <p className="mt-2 text-sm text-rose-700">{message}</p>
        <p className="mt-3 text-xs text-rose-600">Error code: {reason}</p>
        {SSO_LOGIN_URL ? (
          <a
            href={SSO_LOGIN_URL}
            className="mt-5 inline-flex rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800"
          >
            Return To HRMS Login
          </a>
        ) : null}
      </div>
    </div>
  );
};

export default SSOErrorPage;

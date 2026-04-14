# PMS SSO Bootstrap Test Cases

## Preconditions
- PMS frontend running at `http://localhost:5173`
- PMS backend running at `http://localhost:5003`
- `client/.env` has `VITE_API_URL=http://localhost:5003/api/v1`
- Browser DevTools Network tab open with `Preserve log` enabled

## 1. Fresh Login
1. Open `http://localhost:5173/login`.
2. Log in with valid credentials.
3. Verify request sequence:
   - `POST /api/v1/auth/login` returns `200`.
   - `GET /api/auth/me` returns `200`.
4. Verify request headers for protected API calls after login:
   - `Authorization: Bearer <token>`
   - `X-Workspace-ID: <workspaceId>` (preferred) or `X-Org-ID: <orgId/companyId>`
5. Expected result:
   - App redirects to dashboard.
   - No repeated `/login` redirect loop.

## 2. Refresh (Hard Reload)
1. While authenticated, hard refresh (`Ctrl+Shift+R`) on `/dashboard`.
2. Verify bootstrap sequence:
   - Callback token/code is consumed when present.
   - `/api/auth/me` called with `credentials: include`.
3. Expected result:
   - User remains logged in.
   - Context (`workspaceId` or `orgId`) remains populated.
   - No unauthorized page.

## 3. Deep-Link Direct Route
1. Open a direct route (example): `http://localhost:5173/projects`.
2. If context is missing in persisted state, verify:
   - Guard attempts context recovery first.
   - Fallback call to `VITE_SSO_SESSION_ME_URL` (if configured) with `?app=pms`.
3. Expected result:
   - If recovery succeeds: route loads normally.
   - If recovery fails: user is routed to `/unauthorized` only after recovery attempt.

## 4. Logout and Re-Login
1. Click logout.
2. Verify:
   - `POST /api/v1/auth/logout` called.
   - `POST /api/auth/sso-logout` called.
3. Log in again.
4. Expected result:
   - New session bootstraps correctly.
   - `/api/auth/me` returns `200`.
   - Dashboard loads without 401 loop.

## Auth Failure Diagnostics
- For failed auth/context flows, inspect console logs:
  - `[auth:callback_token_validation_failed]`
  - `[auth:session_missing_context_claims]`
  - `[auth:context_recovery_complete]`
  - `[auth:api_unauthorized]`

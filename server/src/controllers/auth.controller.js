import * as AuthService from '../services/auth.service.js';
import { setSSOCookie, clearSSOCookie } from './sso.controller.js';

export async function register(req, res, next) {
  try {
    const { name, email, password, workspace } = req.body;
    const result = await AuthService.register({ name, email, password, workspaceName: workspace });

    // Set SSO cookie so the new user is immediately SSO-authenticated
    setSSOCookie(res, result.ssoAccessToken || result.accessToken);

    return res.status(201).json({
      success: true,
      data: {
        token: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
    });
  } catch (e) {
    return next(e);
  }
}

export async function login(req, res, next) {
  try {
    const { email, companyCode, employeeCode, password } = req.body;
    const result = await AuthService.login({ email, companyCode, employeeCode, password });

    // ─── SSO: set the cross-domain HTTP-only cookie ───────────────────────────
    setSSOCookie(res, result.ssoAccessToken || result.accessToken);
    // ──────────────────────────────────────────────────────────────────────────

    // Existing response shape is preserved — no breaking change for current frontend
    return res.status(200).json({
      success: true,
      data: {
        token: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
    });
  } catch (e) {
    return next(e);
  }
}

export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    const result = await AuthService.refresh({
      refreshToken,
      userAgent: req.headers['user-agent'] || null,
      ip: req.ip,
    });

    // Rotate the SSO cookie with the new access token
    setSSOCookie(res, result.ssoAccessToken || result.accessToken);

    return res.status(200).json({
      success: true,
      data: {
        token: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
    });
  } catch (e) {
    return next(e);
  }
}

export async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body ?? {};
    await AuthService.logout({ refreshToken });

    // Clear the SSO cookie on logout
    clearSSOCookie(res);

    return res.status(200).json({ success: true, data: { ok: true } });
  } catch (e) {
    return next(e);
  }
}

export async function ssoLogout(_req, res) {
  clearSSOCookie(res);
  return res.status(200).json({ success: true, data: { ok: true } });
}

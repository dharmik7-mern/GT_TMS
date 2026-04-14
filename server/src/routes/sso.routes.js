import express from 'express';
import * as SSOController from '../controllers/sso.controller.js';
import { requireAuthSSO } from '../middleware/sso.middleware.js';

const router = express.Router();

/**
 * GET /api/auth/me
 * Used by external apps (HRMS, etc.) to validate the SSO session cookie.
 * Returns the logged-in user's identity or { user: null } with 401.
 */
router.get('/me', SSOController.me);
router.get('/sso/me', SSOController.me);
router.get('/me/permissions', SSOController.mePermissions);
router.get('/callback', SSOController.ssoCallback);
router.post('/callback', SSOController.ssoCallback);
router.post('/logout-sync', SSOController.ssoLogoutSync);

/**
 * POST /api/auth/sso-logout
 * Clears the SSO cookie.  Existing /api/v1/auth/logout is untouched.
 */
router.post('/sso-logout', requireAuthSSO, SSOController.ssoLogout);

export default router;

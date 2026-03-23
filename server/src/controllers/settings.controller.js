import * as SettingsService from '../services/settings.service.js';

export async function getSystem(req, res, next) {
  try {
    const data = await SettingsService.getSystemSettings();
    return res.status(200).json({ success: true, data });
  } catch (e) {
    return next(e);
  }
}

export async function updateSystem(req, res, next) {
  try {
    const data = await SettingsService.updateSystemSettings({
      updates: req.body || {},
      userId: req.auth?.sub || null,
    });
    return res.status(200).json({ success: true, data });
  } catch (e) {
    return next(e);
  }
}

export async function clearCache(req, res, next) {
  try {
    const data = await SettingsService.clearCache();
    return res.status(200).json({ success: true, data });
  } catch (e) {
    return next(e);
  }
}

export async function refreshData(req, res, next) {
  try {
    const data = await SettingsService.refreshSystemData();
    return res.status(200).json({ success: true, data });
  } catch (e) {
    return next(e);
  }
}

export async function testEmail(req, res, next) {
  try {
    const data = await SettingsService.testEmailSettings(req.body || {});
    return res.status(data.ok ? 200 : 400).json({ success: data.ok, data });
  } catch (e) {
    return next(e);
  }
}

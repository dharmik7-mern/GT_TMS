import { verifyAccessToken } from '../utils/jwt.js';
import { getInfrastructureSettings } from '../services/settings.service.js';

const MAINTENANCE_BYPASS_PREFIXES = [
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/settings/system',
];

function canBypassMaintenance(req) {
  if (req.path === '/healthz' || req.path === '/readyz') return true;
  if (!req.path.startsWith('/api/')) return true;
  if (MAINTENANCE_BYPASS_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    const auth = req.headers.authorization || '';
    const [scheme, token] = auth.split(' ');

    if (req.path.startsWith('/api/v1/auth/')) return true;
    if (scheme === 'Bearer' && token) {
      try {
        const decoded = verifyAccessToken(token);
        return ['super_admin', 'admin'].includes(decoded?.role);
      } catch {
        return false;
      }
    }
    return false;
  }
  return false;
}

export async function enforceMaintenanceMode(req, res, next) {
  try {
    const infrastructure = await getInfrastructureSettings();
    if (!infrastructure?.maintenanceMode) return next();
    if (canBypassMaintenance(req)) return next();

    return res.status(503).json({
      success: false,
      error: {
        code: 'MAINTENANCE_MODE',
        message: 'The platform is currently under maintenance. Please try again later.',
      },
    });
  } catch {
    return next();
  }
}

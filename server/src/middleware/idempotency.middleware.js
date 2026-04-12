import crypto from 'crypto';
import IdempotencyRequest from '../models/IdempotencyRequest.js';
import { logger } from '../utils/logger.js';

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortValue(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function hashRequestBody(body) {
  return crypto.createHash('sha256').update(JSON.stringify(sortValue(body || {}))).digest('hex');
}

function buildScopeKey({ tenantId, workspaceId, userId, method, routeKey, idempotencyKey }) {
  return [tenantId, workspaceId || '-', userId, method, routeKey, idempotencyKey].join(':');
}

export function enforceIdempotency({ ttlMs = 10 * 60 * 1000 } = {}) {
  return async (req, res, next) => {
    if (req.method !== 'POST') return next();

    const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
    if (!idempotencyKey) return next();

    const tenantId = String(req.auth?.companyId || '');
    const workspaceId = String(req.auth?.workspaceId || '');
    const userId = String(req.auth?.sub || '');
    const method = String(req.method || 'POST').toUpperCase();
    const routeKey = req.originalUrl.split('?')[0];
    const requestHash = hashRequestBody(req.body);
    const scopeKey = buildScopeKey({ tenantId, workspaceId, userId, method, routeKey, idempotencyKey });
    const expiresAt = new Date(Date.now() + ttlMs);

    try {
      const existing = await IdempotencyRequest.findOne({ scopeKey });

      if (existing) {
        if (existing.requestHash !== requestHash) {
          logger.warn('idempotency_key_reused_with_different_payload', { tenantId, workspaceId, userId, routeKey });
          return res.status(409).json({
            success: false,
            error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key was reused with a different payload.' },
          });
        }

        if (existing.status === 'completed') {
          logger.info('idempotency_cache_hit', { tenantId, workspaceId, userId, routeKey, statusCode: existing.statusCode });
          return res.status(existing.statusCode || 200).json(existing.responseBody);
        }

        logger.warn('idempotency_duplicate_inflight', { tenantId, workspaceId, userId, routeKey });
        return res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_REQUEST', message: 'An identical request is already being processed.' },
        });
      }

      await IdempotencyRequest.create({
        scopeKey,
        tenantId,
        workspaceId,
        userId,
        method,
        routeKey,
        idempotencyKey,
        requestHash,
        status: 'started',
        expiresAt,
      });

      const originalJson = res.json.bind(res);
      res.json = async (body) => {
        const statusCode = res.statusCode || 200;

        try {
          await IdempotencyRequest.findOneAndUpdate(
            { scopeKey },
            {
              $set: {
                status: statusCode >= 500 ? 'failed' : 'completed',
                statusCode,
                responseBody: statusCode >= 500 ? null : body,
                expiresAt,
              },
            }
          );
        } catch (error) {
          logger.error('idempotency_persist_failed', {
            tenantId,
            workspaceId,
            userId,
            routeKey,
            message: error?.message,
          });
        }

        return originalJson(body);
      };

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

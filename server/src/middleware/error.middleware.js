import { logger } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const statusCode = err?.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;

  logger.error('request_error', {
    statusCode,
    message: err?.message,
    stack: err?.stack,
    path: req?.originalUrl,
    method: req?.method,
  });

  if (err?.message === 'CORS_NOT_ALLOWED') {
    return res.status(403).json({
      success: false,
      error: { code: 'CORS_NOT_ALLOWED', message: 'CORS origin not allowed' },
    });
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code: err?.code || 'INTERNAL_ERROR',
      message: statusCode >= 500 ? 'Internal server error' : (err?.message || 'Request failed'),
      details: err?.details,
    },
  });
}


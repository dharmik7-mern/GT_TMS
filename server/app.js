import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { requestLogger } from './src/utils/logger.js';
import { notFoundHandler, errorHandler } from './src/middleware/error.middleware.js';
import { sanitizeMongoBodyParams } from './src/middleware/sanitize.middleware.js';
import { enforceMaintenanceMode } from './src/middleware/system-settings.middleware.js';

import v1Routes from './src/routes/v1/index.js';
import ssoRoutes from './src/routes/sso.routes.js';
import adminCalendarRoutes from './src/routes/admin/calendar.routes.js';
import adminChatRoutes from './src/routes/admin/adminChat.routes.js';
import adminDashboardRoutes from './src/routes/admin/adminDashboard.routes.js';
import adminNotificationRoutes from './src/routes/admin/adminNotification.routes.js';
import { sendMail } from './src/services/mail.service.js';
import { welcomeTemplate } from './src/templates/mail.templates.js';

const app = express();

// ─── __dirname fix (ESM) ───────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Frontend build path ───────────────────────────────────────────────────
const clientBuildDir = path.join(__dirname, '../client/dist');
const clientIndexFile = path.join(clientBuildDir, 'index.html');

// ─── Trust proxy (needed for secure cookies behind reverse-proxy / IIS) ────
app.disable('x-powered-by');
app.set('trust proxy', 1);

// ─── HELMET ───────────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: [
          "'self'",
          "https://www.google-analytics.com",
          // Allow HRMS and other SSO consumers to call this API
          ...parseCorsOrigins(),
        ],
        scriptSrc: ["'self'", "'unsafe-inline'", "blob:"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "http:", "https:", "http://localhost:5000"],
      },
    },
  })
);

app.use(hpp());
app.use(compression());
app.use(requestLogger());
app.use(sanitizeMongoBodyParams);

// ─── CORS — SSO-aware ─────────────────────────────────────────────────────
// Reads allowed origins from CORS_ORIGIN (comma-separated).
// credentials: true is required so cookies are sent cross-origin.
const allowedOrigins = parseCorsOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, same-domain)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true, // ← required for cookies to be sent cross-origin
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-HTTP-Method-Override'],
    exposedHeaders: ['Set-Cookie'],
  })
);

// ─── Cookie parser (required for SSO cookie reading) ──────────────────────
app.use(cookieParser());

app.use(express.json({ limit: '1mb' }));

// ─── WAF workaround: tunnel PUT/PATCH/DELETE via POST + X-HTTP-Method-Override ──
app.use((req, _res, next) => {
  if (req.method === 'POST') {
    const headerValue = req.headers['x-http-method-override'];
    if (typeof headerValue === 'string') {
      const candidate = headerValue.trim().toUpperCase();
      if (candidate === 'PUT' || candidate === 'PATCH' || candidate === 'DELETE') {
        req.method = candidate;
      }
    }
  }
  next();
});

// ─── Rate limiting ────────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
  })
);

// ─── Health checks ───────────────────────────────────────────────────────
app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.get('/readyz', (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  if (ready) return res.json({ ok: true, db: 'connected' });
  res.status(503).json({ ok: false, db: 'disconnected' });
});

// ─── Static files ─────────────────────────────────────────────────────────
app.use('/assets', express.static(path.join(clientBuildDir, 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(clientBuildDir));

// ─── Maintenance gate ─────────────────────────────────────────────────────
app.use(enforceMaintenanceMode);

// ─── API routes ───────────────────────────────────────────────────────────

// SSO endpoints (cross-domain, no version prefix — easy to call from HRMS)
// Exposes: GET  /api/auth/me
//          POST /api/auth/sso-logout
app.use('/api/auth', ssoRoutes);

// Existing versioned routes — untouched
app.use('/api/v1', v1Routes);
app.use('/api/admin/calendar', adminCalendarRoutes);
app.use('/api/admin/chat', adminChatRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/notifications', adminNotificationRoutes);
app.use('/api/v1/admin/calendar', adminCalendarRoutes);
app.use('/api/v1/admin/chat', adminChatRoutes);
app.use('/api/v1/admin/dashboard', adminDashboardRoutes);
app.use('/api/v1/admin/notifications', adminNotificationRoutes);

// ─── React SPA catch-all ──────────────────────────────────────────────────
if (fs.existsSync(clientIndexFile)) {
  app.get(
    /^\/(?!api(?:\/|$)|uploads(?:\/|$)|assets(?:\/|$)|healthz$|readyz$).*/,
    (_req, res) => {
      res.sendFile(clientIndexFile);
    }
  );
}

// ─── Error handling ───────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Parse CORS_ORIGIN env var into an array.
 * Supports comma-separated values, e.g.:
 *   CORS_ORIGIN=http://localhost:5173,https://projects.gitakshmi.com,https://hrms.gitakshmi.com
 */
function parseCorsOrigins() {
  const raw = process.env.CORS_ORIGIN || '';
  if (!raw.trim()) return ['*'];
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

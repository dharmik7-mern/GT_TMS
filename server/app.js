import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
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
import adminCalendarRoutes from './src/routes/admin/calendar.routes.js';
import adminChatRoutes from './src/routes/admin/adminChat.routes.js';
import adminDashboardRoutes from './src/routes/admin/adminDashboard.routes.js';
import adminNotificationRoutes from './src/routes/admin/adminNotification.routes.js';
import {sendMail} from './src/services/mail.service.js'
import {welcomeTemplate} from './src/templates/mail.templates.js'
const app = express();

// ✅ __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ FRONTEND BUILD PATH (FINAL)
const clientBuildDir = path.join(__dirname, '../client/dist');
const clientIndexFile = path.join(clientBuildDir, 'index.html');

// ✅ BASIC SETTINGS
app.disable('x-powered-by');
app.set('trust proxy', 1);

// ✅ HELMET (CSP FIXED)
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: [
          "'self'",
          "https://www.google-analytics.com"
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

// ✅ CORS
app.use(cors({
  origin: '*',
  credentials: false,
}));

app.use(express.json({ limit: '1mb' }));

// ✅ RATE LIMIT
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
}));

// ✅ HEALTH
app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.get('/readyz', (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  if (ready) return res.json({ ok: true, db: 'connected' });
  res.status(503).json({ ok: false, db: 'disconnected' });
});

// ✅ STATIC FILES (MOST IMPORTANT)
app.use('/assets', express.static(path.join(clientBuildDir, 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(clientBuildDir));

// ✅ MAINTENANCE
app.use(enforceMaintenanceMode);

// ✅ API ROUTES
app.use('/api/v1', v1Routes);
app.use('/api/admin/calendar', adminCalendarRoutes);
app.use('/api/admin/chat', adminChatRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/notifications', adminNotificationRoutes);
app.use('/api/v1/admin/calendar', adminCalendarRoutes);
app.use('/api/v1/admin/chat', adminChatRoutes);
app.use('/api/v1/admin/dashboard', adminDashboardRoutes);
app.use('/api/v1/admin/notifications', adminNotificationRoutes);

// ✅ REACT ROUTING (FIXED REGEX)
if (fs.existsSync(clientIndexFile)) {
  app.get(
    /^\/(?!api(?:\/|$)|uploads(?:\/|$)|assets(?:\/|$)|healthz$|readyz$).*/,
    (_req, res) => {
      res.sendFile(clientIndexFile);
    }
  );
}

// ✅ ERROR HANDLING
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

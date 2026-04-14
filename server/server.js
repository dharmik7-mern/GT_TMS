import dotenv from 'dotenv';
import path from 'path';

const envFile =
  process.env.NODE_ENV === 'production'
    ? path.join(process.cwd(), '.env.production')
    : path.join(process.cwd(), '.env');

dotenv.config({ path: envFile });

import app from "./app.js"
import connectDB from './src/config/db.js';
import { alignProjectIndexes } from './src/config/indexes.js';
import { ensureBootstrapSuperAdmin, ensureSystemTestTenant } from './src/config/seed.js';
import { startReportAutomationScheduler } from './src/services/reportAutomation.service.js';
import { isValidOrganizationId, normalizeOrganizationId } from './src/utils/organizationId.js';

const port = process.env.PORT || '5000';

function preflightBootstrapOrganizationIdEnv() {
  const value = normalizeOrganizationId(process.env.DEFAULT_ORGANIZATION_ID);
  if (value && isValidOrganizationId(value)) return;
  if (value && !isValidOrganizationId(value)) {
    console.error(
      `[startup] DEFAULT_ORGANIZATION_ID="${value}" is invalid. Use a non-empty value up to 80 chars.`
    );
    return;
  }
  console.error(
    '[startup] DEFAULT_ORGANIZATION_ID is not set. Bootstrap seed will skip company creation when no existing bootstrap company is found. Set DEFAULT_ORGANIZATION_ID to a unique value.'
  );
}

async function runStartupTask(label, fn, { required = false } = {}) {
  try {
    await fn();
  } catch (error) {
    console.error(`[startup] ${label} failed:`, error.message);
    if (required) throw error;
  }
}

async function startServer() {
  await connectDB();
  await alignProjectIndexes();
  preflightBootstrapOrganizationIdEnv();
  await runStartupTask('ensureBootstrapSuperAdmin', ensureBootstrapSuperAdmin);
  await runStartupTask('ensureSystemTestTenant', ensureSystemTestTenant);
  startReportAutomationScheduler();

  app.listen(port, () => {
    console.log('Server is listening on PORT:', port);
    const rateLimitEnabled =
      process.env.RATE_LIMIT_ENABLED === 'true' ||
      (process.env.RATE_LIMIT_ENABLED !== 'false' && process.env.NODE_ENV === 'production');
    console.log(`[startup] rate_limit_enabled=${rateLimitEnabled} (RATE_LIMIT_ENABLED=${process.env.RATE_LIMIT_ENABLED || 'unset'})`);
  });
}

startServer().catch((error) => {
  console.error('Server startup failed:', error.message);
  process.exit(1);
});

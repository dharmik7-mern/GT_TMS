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
import { ensureBootstrapSuperAdmin, ensureDevSeed } from './src/config/seed.js';

const port = process.env.PORT || '5000';

async function startServer() {
  await connectDB();
  await alignProjectIndexes();
  await ensureBootstrapSuperAdmin();
  if (process.env.NODE_ENV !== 'production') {
    await ensureDevSeed();
  }

  app.listen(port, () => {
    console.log('Server is listening on PORT:', port);
  });
}

startServer().catch((error) => {
  console.error('Server startup failed:', error.message);
  process.exit(1);
});

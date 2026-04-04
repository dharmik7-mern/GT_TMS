import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTenantModels } from './src/config/tenantDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function test() {
  const companyId = '69c2559b4b1f2470d9aecb7f'; // From metadata
  const workspaceId = '65f000000000000000000001'; // Mock
  
  console.log('Connecting to DB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  try {
    const { Label } = await getTenantModels(companyId);
    console.log('Creating label...');
    const label = await Label.create({
      tenantId: companyId,
      workspaceId,
      name: 'Test Label ' + Date.now(),
      color: '#ff0000'
    });
    console.log('Created label:', label);
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await mongoose.disconnect();
  }
}

test();

import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Company from '../src/models/Company.js';
import AuthLookup from '../src/models/AuthLookup.js';

/**
 * Migration: single DB -> DB-per-tenant.
 *
 * Assumptions:
 * - You currently have a single database (the one pointed to by MONGO_URI) containing
 *   tenant-scoped collections with a `companyId` field.
 * - You want to keep that database as the *shared* database (companies + auth_lookup),
 *   and copy tenant-scoped docs into per-tenant databases named `PMS_<companyId>`.
 *
 * Usage:
 * - Set MONGO_URI to the current (single) DB connection string.
 * - Run: node scripts/migrate-to-tenant-dbs.js
 * - Optional: FORCE=1 to overwrite target tenant DBs (drops collections).
 */

const FORCE = process.env.FORCE === '1';

const TENANT_COLLECTIONS = [
  'users',
  'workspaces',
  'memberships',
  'projects',
  'tasks',
  'teams',
  'quicktasks',
  'notifications',
  'activitylogs',
  'refreshtokens',
];

function tenantDbName(companyId) {
  return `PMS_${String(companyId)}`;
}

async function ensureTenantEmptyOrDrop(tenantDb) {
  const existingCollections = await tenantDb.listCollections().toArray();
  const existingTenantCollections = existingCollections
    .map((c) => c.name)
    .filter((n) => TENANT_COLLECTIONS.includes(n));

  if (existingTenantCollections.length === 0) return;
  if (!FORCE) {
    throw new Error(
      `Target tenant DB already has tenant collections: ${existingTenantCollections.join(', ')}. Set FORCE=1 to drop them and re-run.`
    );
  }

  await Promise.all(existingTenantCollections.map((name) => tenantDb.dropCollection(name)));
}

async function main() {
  await connectDB();

  const globalDb = mongoose.connection.db;
  const companies = await Company.find().sort({ createdAt: 1 });
  if (companies.length === 0) {
    console.log('No companies found. Nothing to migrate.');
    return;
  }

  console.log(`Found ${companies.length} companies. Starting migration. FORCE=${FORCE ? '1' : '0'}`);

  for (const company of companies) {
    const cId = company._id;
    const dbName = tenantDbName(cId);

    const tenantConn = mongoose.connection.useDb(dbName, { useCache: true });
    const tenantDb = tenantConn.db;

    console.log(`\nMigrating company ${company.name} (${company.id}) -> ${dbName}`);
    await ensureTenantEmptyOrDrop(tenantDb);

    // Copy tenant-scoped docs (preserve _id to keep references stable)
    for (const collName of TENANT_COLLECTIONS) {
      const docs = await globalDb.collection(collName).find({ companyId: cId }).toArray();
      if (docs.length === 0) continue;
      await tenantDb.collection(collName).insertMany(docs, { ordered: false });
      console.log(`- ${collName}: ${docs.length} copied`);
    }

    // Create/refresh global auth_lookup entries for users
    const userDocs = await tenantDb.collection('users').find({}, { projection: { email: 1 } }).toArray();
    if (userDocs.length) {
      await AuthLookup.bulkWrite(
        userDocs
          .filter((u) => u?.email)
          .map((u) => ({
            updateOne: {
              filter: { email: String(u.email).toLowerCase() },
              update: { $set: { email: String(u.email).toLowerCase(), companyId: cId } },
              upsert: true,
            },
          })),
        { ordered: false }
      );
      console.log(`- auth_lookup: ${userDocs.length} upserted`);
    }
  }

  console.log('\nMigration complete.');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e?.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });


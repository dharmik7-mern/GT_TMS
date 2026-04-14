import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gt_pms';

async function check() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to', MONGO_URI);
  
  const conn = mongoose.connection;
  
  console.log('\n--- AuthLookup ---');
  const lookups = await conn.db.collection('authlookups').find({ email: /ivaharpal|gitakshmi/ }).toArray();
  for (const l of lookups) {
    console.log(`Lookup: email=${l.email}, tenantId=${l.tenantId}`);
  }

  console.log('\n--- Companies ---');
  const companies = await conn.db.collection('companies').find({ email: /ivaharpal|gitakshmi/ }).toArray();
  for (const c of companies) {
    console.log(`Company: id=${c._id}, email=${c.email}, name=${c.name}, db=${c.databaseName}`);
  }
  
  console.log('\n--- User Records in Tenants ---');
  const allCompanies = await conn.db.collection('companies').find({}).toArray();
  
  for (const company of allCompanies) {
    const dbName = company.databaseName;
    if (!dbName) continue;
    
    // console.log('Checking tenant DB:', dbName);
    const tenantConn = conn.useDb(dbName);
    const users = await tenantConn.collection('users').find({ email: /ivaharpal|gitakshmi/ }).toArray();
    
    for (const u of users) {
       console.log(`User found in ${dbName}: id=${u._id}, email=${u.email}, hashPrefix=${u.passwordHash?.substring(0, 10)}, role=${u.role}`);
    }
  }
  
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});

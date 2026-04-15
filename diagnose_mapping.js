import mongoose from 'mongoose';
import Company from './server/src/models/Company.js';
import User from './server/src/models/User.js';
import AuthLookup from './server/src/models/AuthLookup.js';

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const email = 'niteshbaldanitya@gmail.com';
  const lookup = await AuthLookup.findOne({ email }).lean();
  console.log('AuthLookup result:', lookup);

  if (lookup) {
     const company = await Company.findById(lookup.tenantId).lean();
     console.log('Company found:', company?.name, company?.organizationId);
  }

  const allCompanies = await Company.find().select('name organizationId').limit(10).lean();
  console.log('Sample Companies:', allCompanies);

  const hrmsCompanies = await mongoose.connection.useDb('hrms').db.collection('tenants').find().project({ companyName: 1, tenantId: 1, code: 1, companyEmail: 1 }).limit(10).toArray();
  console.log('Sample HRMS Tenants:', hrmsCompanies);

  process.exit(0);
}

run().catch(console.error);

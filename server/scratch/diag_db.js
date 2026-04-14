import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkCollections() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to:', mongoose.connection.name);
    
    // Check main users
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log('--- Users in HRMS DB ---');
    users.forEach(u => console.log(`Email: ${u.email}, Name: ${u.name}, Tenant: ${u.tenantId}`));

    // Check if there is an employees collection
    const employees = await mongoose.connection.db.collection('employees').find({}).toArray();
    console.log('\n--- Employees in HRMS DB ---');
    employees.forEach(e => console.log(`Email: ${e.email}, Name: ${e.name}, Tenant: ${e.tenantId}`));

    // Check Companies to see ID map
    const companies = await mongoose.connection.db.collection('companies').find({}).toArray();
    console.log('\n--- Companies ---');
    companies.forEach(c => console.log(`ID: ${c._id}, Name: ${c.name}`));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkCollections();

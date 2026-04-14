import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkNiteshHRMS() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.useDb('company_69ddd0f7800b442c114befbe');
    
    // Check users
    const users = await db.collection('users').find({}).toArray();
    console.log('--- Users in HRMS Tenant DB ---');
    users.forEach(u => console.log(`Email: ${u.email}, Name: ${u.name}`));

    // Check employees
    const employees = await db.collection('employees').find({}).toArray();
    console.log('\n--- Employees in HRMS Tenant DB ---');
    employees.forEach(e => console.log(`Email: ${e.email}, Name: ${e.name}, Role: ${e.role}`));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkNiteshHRMS();

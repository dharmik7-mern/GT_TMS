const mongoose = require('mongoose');

async function listEmployees() {
  await mongoose.connect('mongodb://127.0.0.1:27017/gt_pms');
  console.log('Connected to DB: gt_pms\n');

  const users = await mongoose.connection.collection('users').find(
    {},
    { projection: { _id: 1, name: 1, email: 1, role: 1, department: 1, jobTitle: 1, isActive: 1 } }
  ).toArray();

  console.log(`Total Employees Found: ${users.length}\n`);
  console.log('--------------------------------------------');
  users.forEach((u, i) => {
    console.log(`[${i + 1}] ID    : ${u._id}`);
    console.log(`     Name  : ${u.name}`);
    console.log(`     Email : ${u.email}`);
    console.log(`     Role  : ${u.role}`);
    console.log(`     Dept  : ${u.department || 'N/A'}`);
    console.log(`     Active: ${u.isActive}`);
    console.log('--------------------------------------------');
  });

  await mongoose.disconnect();
}

listEmployees().catch(console.error);

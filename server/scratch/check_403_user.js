import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const id = '69dc90651262f9551e6d879f';
    
    // Check all DBs
    const dbs = ['hrms', 'GT_PMS_nitesh_legacy_442c114befbe', 'company_69ddd0f7800b442c114befbe'];
    for (const dbName of dbs) {
      const db = mongoose.connection.useDb(dbName);
      const user = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(id) });
      if (user) {
        console.log(`Found in ${dbName}:`, user.email, user.name);
        return;
      }
      const emp = await db.collection('employees').findOne({ _id: new mongoose.Types.ObjectId(id) });
      if (emp) {
        console.log(`Found employee in ${dbName}:`, emp.email, emp.firstName);
        return;
      }
    }
    console.log('User not found anywhere');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkUser();

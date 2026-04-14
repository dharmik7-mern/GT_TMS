import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkDbs() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const admin = mongoose.connection.db.admin();
    const dbs = await admin.listDatabases();
    console.log('--- Databases ---');
    dbs.databases.forEach(db => console.log(db.name));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDbs();

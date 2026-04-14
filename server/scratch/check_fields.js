import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkFields() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.useDb('company_69ddd0f7800b442c114befbe');
    const emp = await db.collection('employees').findOne({ email: 'jay@gmail.com' });
    console.log(JSON.stringify(emp, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkFields();

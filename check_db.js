
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect('mongodb://localhost:27017/gt_tms');
  const task = await mongoose.connection.collection('tasks').findOne({}, { sort: { updatedAt: -1 } });
  console.log('Task:', task.title);
  console.log('Subtasks:', JSON.stringify(task.subtasks, null, 2));
  await mongoose.disconnect();
}

check().catch(console.error);

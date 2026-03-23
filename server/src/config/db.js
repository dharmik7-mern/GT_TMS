import mongoose from 'mongoose';

function getMongoUri() {
  return process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/PMS';
}

const connectDB = async () => {
  const mongoURI = getMongoUri();

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log('Database connected successfully', conn.connection.host);
    return conn;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    console.error('Mongo URI:', mongoURI);
    throw error;
  }
};

export default connectDB;

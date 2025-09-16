import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;
const DATABASE = process.env.MONGODB_DATABASE;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI not found in environment variables');
}
if (!DATABASE) {
  throw new Error('MONGODB_DATABASE not found in environment variables');
}

export async function connectToMongo() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DATABASE,
    });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB', err);
    throw err;
  }
}

export function getDefaultConnection(): mongoose.Connection {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB default connection is not ready. Call connectToMongo() first.');
  }
  return mongoose.connection;
}

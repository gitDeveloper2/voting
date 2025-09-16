import mongoose, { Connection } from 'mongoose';

const MAIN_DB_URI = process.env.MAIN_MONGODB_URI!;
const MAIN_DB_NAME = process.env.MAIN_MONGODB_DATABASE;

let mainConnection: Connection | null = null;

export async function getMainConnection(): Promise<Connection> {
  if (mainConnection && mainConnection.readyState === 1) return mainConnection;

  if (!MAIN_DB_URI) {
    throw new Error('MAIN_MONGODB_URI not set');
  }

  mainConnection = mongoose.createConnection(MAIN_DB_URI, {
    dbName: MAIN_DB_NAME,
  });

  mainConnection.on('connected', () => {
    console.log('✅ Connected to main app MongoDB');
  });

  mainConnection.on('error', (err) => {
    console.error('❌ Main DB connection error:', err);
  });

  await mainConnection.asPromise();
  return mainConnection;
}


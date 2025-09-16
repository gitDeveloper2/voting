// This file is deprecated - the Voting API now uses native MongoDB driver
// See src/lib/mongodb.ts for the current database connection

const MONGODB_URI = process.env.MONGODB_URI!;
const DATABASE = process.env.MONGODB_DATABASE;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI not found in environment variables');
}
if (!DATABASE) {
  throw new Error('MONGODB_DATABASE not found in environment variables');
}

export async function connectToMongo() {
  throw new Error('Mongoose connection deprecated. Use connectToDatabase() from @/lib/mongodb instead.');
}

export function getDefaultConnection() {
  throw new Error('Mongoose connection deprecated. Use connectToDatabase() from @/lib/mongodb instead.');
}

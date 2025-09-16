// This file is deprecated - the Voting API now uses native MongoDB driver
// Main app connection is handled through src/lib/mongodb.ts

export async function getMainConnection() {
  throw new Error('Main DB connection deprecated. Use connectToDatabase() from @/lib/mongodb instead.');
}

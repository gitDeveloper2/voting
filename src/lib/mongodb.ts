import { MongoClient, Db } from "mongodb";

const uri = process.env.MAIN_MONGODB_URI || "mongodb://localhost:27017";
const databasename = process.env.MONGODB_DATABASE || "basicutils";

const client = new MongoClient(uri);

let db: Db;

export async function connectToDatabase() {
  if (!db) {
    try {
      console.log('🔌 Attempting to connect to MongoDB:', uri);
      console.log('📊 Database name:', databasename);
      await client.connect();
      db = client.db(databasename);
      console.log('✅ MongoDB connected successfully');
    } catch (error) {
      console.error('💥 MongoDB connection failed:', error);
      throw new Error("Database connection error");
    }
  }

  return { db, client };
}

export const dbObject = client.db(databasename);

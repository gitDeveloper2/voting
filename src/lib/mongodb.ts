import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const databasename = process.env.MONGODB_DATABASE || "basicutils";

const client = new MongoClient(uri);

let db: Db;

export async function connectToDatabase() {
  if (!db) {
    try {
      await client.connect();
      db = client.db(databasename);
    } catch (error) {
      throw new Error("Database connection error");
    }
  }

  return { db, client };
}

export const dbObject = client.db(databasename);

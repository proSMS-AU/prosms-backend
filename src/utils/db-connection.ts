import "dotenv/config";
import config from "config";
import mongoose from "mongoose";
import { logger } from "./logger";

export async function dbConnection() {
  const URI = config.get<string>("db.uri");
  await mongoose.connect(URI, {});

  logger.info("Connected to the database");
}

// Export the native MongoDB client and database for better-auth
export function getMongoClient() {
  return mongoose.connection.getClient();
}

export function getMongoDb() {
  return mongoose.connection.db;
}

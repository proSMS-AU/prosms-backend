import "dotenv/config";
import mongoose from "mongoose";
import { dbConnection } from "./db-connection";
import { seedSuperAdmin } from "./seedSuperAdmin";
import { logger } from "./logger";

/**
 * One-off: DROP the entire configured database, then seed the super admin.
 * DESTRUCTIVE — requires the explicit --yes-drop flag to run.
 *
 *   npx ts-node src/utils/resetAndSeed.ts --yes-drop
 */
const run = async (): Promise<void> => {
  if (!process.argv.includes("--yes-drop")) {
    logger.error("[Reset] Refusing to run without --yes-drop flag (this drops the whole database).");
    process.exit(1);
  }

  await dbConnection();
  const db = mongoose.connection.db;
  if (!db) {
    logger.error("[Reset] No database handle available");
    process.exit(1);
  }

  const dbName = db.databaseName;
  const collections = await db.listCollections().toArray();
  logger.info(`[Reset] Resetting database "${dbName}" (${collections.length} collections)...`);

  for (const { name } of collections) {
    if (name.startsWith("system.")) continue;
    try {
      await db.collection(name).drop();
      logger.info(`[Reset]   dropped collection "${name}"`);
    } catch {
      // Fallback when the Atlas user can't drop: empty the collection instead
      const res = await db.collection(name).deleteMany({});
      logger.info(`[Reset]   could not drop "${name}", cleared ${res.deletedCount} docs instead`);
    }
  }
  logger.info(`[Reset] Database "${dbName}" reset complete.`);

  await seedSuperAdmin();

  await mongoose.disconnect();
  logger.info("[Reset] Done. Disconnected.");
  process.exit(0);
};

run().catch((err) => {
  logger.error("[Reset] Failed", err);
  process.exit(1);
});

/**
 * Migration 005 — Create sparse compound unique index on students(organizationId, avetmissId)
 *
 * Background: avetmissId was previously stored with no uniqueness constraint per org,
 * allowing duplicate AVETMISS IDs to be created via NAT import or manual entry.
 * The index enforces org-scoped uniqueness going forward. Sparse means documents
 * with no avetmissId are excluded (students can still exist without one).
 *
 * Run this ONCE before deploying the code that adds the @Index decorator.
 * The decorator tells Mongoose to maintain the index on subsequent startups,
 * but the migration handles the initial creation without a restart.
 *
 * Usage:
 *   npx ts-node src/utils/migrations/005-avetmiss-id-unique-index.ts            (check)
 *   npx ts-node src/utils/migrations/005-avetmiss-id-unique-index.ts --commit   (create index)
 */

import "dotenv/config";
import mongoose from "mongoose";
import { dbConnection } from "../db-connection";
import { logger } from "../logger";

const run = async () => {
  const isDryRun = !process.argv.includes("--commit");
  await dbConnection();
  logger.info(`[Migration 005] Starting... (${isDryRun ? "DRY RUN" : "COMMIT MODE"})`);

  const db = mongoose.connection.db!;
  const col = db.collection("students");

  // Check for existing duplicates before creating the unique index.
  const duplicates = await col
    .aggregate([
      { $match: { avetmissId: { $exists: true, $nin: [null, ""] } } },
      { $group: { _id: { organizationId: "$organizationId", avetmissId: "$avetmissId" }, count: { $sum: 1 }, ids: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } }
    ])
    .toArray();

  if (duplicates.length > 0) {
    logger.warn(`[Migration 005] Found ${duplicates.length} duplicate avetmissId group(s) — resolve before creating the index:`);
    for (const dup of duplicates) {
      logger.warn(`  org=${dup._id.organizationId} avetmissId="${dup._id.avetmissId}" docs=${JSON.stringify(dup.ids)}`);
    }
    logger.warn("[Migration 005] Aborted — fix duplicates first, then re-run.");
    process.exit(1);
  }

  logger.info("[Migration 005] No duplicates found.");

  if (isDryRun) {
    logger.info("[Migration 005] DRY RUN complete. Pass --commit to create the index.");
  } else {
    await col.createIndex(
      { organizationId: 1, avetmissId: 1 },
      { unique: true, sparse: true, name: "organizationId_1_avetmissId_1" }
    );
    logger.info("[Migration 005] Index created successfully.");
  }

  process.exit(0);
};

run().catch((err) => {
  logger.error("[Migration 005] Failed", err);
  process.exit(1);
});

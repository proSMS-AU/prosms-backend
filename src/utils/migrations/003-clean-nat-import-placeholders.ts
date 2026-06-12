/**
 * Migration 003 — Clean NAT-import placeholder contact data
 *
 * Background: older NAT imports fabricated contact data when the file had none:
 *   - email  → "imported-<avetmissId>@prosms.local"
 *   - phone  → { countryCode: "+61", number: "0000000000" }
 * The importer no longer does this (real data only, otherwise left empty). This
 * script removes the already-stored placeholders so no fallback/guard code is
 * needed anywhere — the fields are simply absent when there is no real value.
 *
 * It also migrates the unique email index to a SPARSE unique index, which is
 * required for many email-less students to coexist (a plain unique index treats
 * every missing email as the same null and rejects the second one).
 *
 * Order matters: the non-sparse index is dropped BEFORE emails are unset, then
 * the sparse index is (re)created afterwards.
 *
 * Safe to re-run (idempotent — only matches the exact placeholder shapes).
 *
 * Usage:
 *   npx ts-node src/utils/migrations/003-clean-nat-import-placeholders.ts
 *   npx ts-node src/utils/migrations/003-clean-nat-import-placeholders.ts --commit
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";
import { dbConnection } from "../db-connection";
import { StudentModel } from "../../model/student.model";
import { logger } from "../logger";

// Exact placeholders the old importer wrote — only these are cleaned.
const PLACEHOLDER_EMAIL = /^imported-.*@prosms\.local$/i;
const PLACEHOLDER_PHONE_NUMBER = "0000000000";

const run = async () => {
  const isDryRun = !process.argv.includes("--commit");
  await dbConnection();
  logger.info(`[Migration 003] Starting... (${isDryRun ? "DRY RUN — pass --commit to write" : "COMMIT MODE"})`);

  const emailFilter = { "contactDetails.email": { $regex: PLACEHOLDER_EMAIL } };
  const phoneFilter = { "contactDetails.personalPhone.number": PLACEHOLDER_PHONE_NUMBER };

  const fakeEmailCount = await StudentModel.countDocuments(emailFilter);
  const placeholderPhoneCount = await StudentModel.countDocuments(phoneFilter);
  logger.info(
    `[Migration 003] Found placeholder emails=${fakeEmailCount}, placeholder phones=${placeholderPhoneCount}`
  );

  // 1. Drop the old non-sparse unique email index (blocks unsetting many emails).
  const indexes = (await StudentModel.collection.indexes()) as any[];
  const emailIdx = indexes.find((ix) => ix?.key && ix.key["contactDetails.email"] === 1);
  if (emailIdx && !emailIdx.sparse) {
    logger.info(`  [index] dropping non-sparse email index "${emailIdx.name}"`);
    if (!isDryRun) await StudentModel.collection.dropIndex(emailIdx.name);
  } else if (emailIdx) {
    logger.info(`  [index] email index "${emailIdx.name}" is already sparse — leaving as is`);
  } else {
    logger.info(`  [index] no existing email index found`);
  }

  // 2. Remove fabricated emails entirely (field absent, not "" / null).
  if (!isDryRun) {
    const res = await StudentModel.updateMany(emailFilter, { $unset: { "contactDetails.email": "" } });
    logger.info(`  [email] cleared ${res.modifiedCount} placeholder emails`);
  }

  // 3. Remove placeholder phones entirely.
  if (!isDryRun) {
    const res = await StudentModel.updateMany(phoneFilter, { $unset: { "contactDetails.personalPhone": "" } });
    logger.info(`  [phone] cleared ${res.modifiedCount} placeholder phones`);
  }

  // 4. (Re)create the sparse unique email index.
  if (!isDryRun && (!emailIdx || !emailIdx.sparse)) {
    try {
      await StudentModel.collection.createIndex({ "contactDetails.email": 1 }, { unique: true, sparse: true });
      logger.info(`  [index] created sparse unique index on contactDetails.email`);
    } catch (err) {
      logger.warn(`  [index] could not create sparse unique index (duplicate real emails?): ${(err as Error).message}`);
    }
  }

  logger.info(`[Migration 003] ${isDryRun ? "DRY RUN complete (no writes)" : "Done"}.`);
  process.exit(0);
};

run().catch((err) => {
  logger.error("[Migration 003] Failed", err);
  process.exit(1);
});

/**
 * Migration 004 — VET birthCountry / citizenshipCountry / language: name → code
 *
 * Background: these fields were previously stored as free-text names (e.g. "Bangladesh",
 * "Mandarin") because the old frontend dropdowns used names as their value. The dropdowns
 * now store the 4-digit SACC/ASCL code, so existing records must be converted for the edit
 * form to show them selected (and for consistency with the reference-data source of truth).
 *
 * Approach (native driver, bypasses Mongoose strict mode):
 *   - For each student, look at vetDetails.birthCountry, .citizenshipCountry, .language.
 *   - Already a valid code → skip (idempotent).
 *   - Resolves to a code via the shared reference-data maps → update.
 *   - Cannot be resolved → log for manual review, leave untouched (never overwrite the
 *     original with "@@@@", so no data is lost).
 *
 * Usage:
 *   npx ts-node src/utils/migrations/004-sacc-ascl-name-to-code.ts            (dry run)
 *   npx ts-node src/utils/migrations/004-sacc-ascl-name-to-code.ts --commit   (write)
 */

import "dotenv/config";
import mongoose from "mongoose";
import { dbConnection } from "../db-connection";
import { logger } from "../logger";
import { resolveCountryCode, resolveLanguageCode } from "../../services/referenceData.service";

type Resolver = (value: string | undefined) => string;

const run = async () => {
  const isDryRun = !process.argv.includes("--commit");
  await dbConnection();
  logger.info(`[Migration 004] Starting... (${isDryRun ? "DRY RUN — pass --commit to write" : "COMMIT MODE"})`);

  const db = mongoose.connection.db!;
  const studentsCol = db.collection("students");

  const fields: Array<{ path: string; resolver: Resolver; label: string }> = [
    { path: "vetDetails.birthCountry", resolver: resolveCountryCode, label: "birthCountry" },
    { path: "vetDetails.citizenshipCountry", resolver: resolveCountryCode, label: "citizenshipCountry" },
    { path: "vetDetails.language", resolver: resolveLanguageCode, label: "language" }
  ];

  const orFilter = fields.map((f) => ({ [f.path]: { $exists: true, $ne: "" } }));
  const students = await studentsCol.find({ $or: orFilter }).toArray();

  logger.info(`[Migration 004] Scanning ${students.length} student(s) with at least one VET code field set.`);

  const counts = { updated: 0, alreadyCode: 0, unresolved: 0 };

  for (const student of students) {
    const set: Record<string, string> = {};

    for (const { path, resolver, label } of fields) {
      const [a, b] = path.split(".");
      const current: string = (student[a]?.[b] ?? "").toString().trim();
      if (!current) continue;

      const resolved = resolver(current);

      if (resolved === current) {
        counts.alreadyCode += 1; // already a valid code — nothing to do
        continue;
      }
      if (resolved === "@@@@") {
        counts.unresolved += 1;
        logger.warn(`  [unresolved] student ${student._id} ${label}="${current}" — left untouched, review manually`);
        continue;
      }

      logger.info(`  [update] student ${student._id} ${label}: "${current}" → "${resolved}"`);
      set[path] = resolved;
      counts.updated += 1;
    }

    if (!isDryRun && Object.keys(set).length > 0) {
      // eslint-disable-next-line no-await-in-loop
      await studentsCol.updateOne({ _id: student._id }, { $set: set });
    }
  }

  logger.info(
    `[Migration 004] ${isDryRun ? "DRY RUN" : "Done"}. ` +
      `fieldsUpdated=${counts.updated}, alreadyCode=${counts.alreadyCode}, unresolved=${counts.unresolved}`
  );
  process.exit(0);
};

run().catch((err) => {
  logger.error("[Migration 004] Failed", err);
  process.exit(1);
});

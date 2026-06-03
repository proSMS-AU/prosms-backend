/**
 * Migration 002 — fundingSourceNational: Class → Student
 *
 * Background (R-06): student.fundingSourceNational is the source of truth for AVETMISS
 * NAT00120. The class-level value is now only a default. Existing data only has the
 * value at the class level; this script seeds the student-level field from their enrolled
 * class(es) so the AVETMISS export uses the correct per-student override going forward.
 *
 * Rules:
 *   - Skip students who already have fundingSourceNational set.
 *   - If a student's enrolled classes all share the same non-empty fundingSourceNational,
 *     copy it to the student.
 *   - If classes disagree (different non-empty values), log a warning and skip — manual
 *     review required.
 *
 * Safe to re-run (idempotent — students that already have the field set are skipped).
 *
 * Usage:
 *   npx ts-node src/utils/migrations/002-funding-source-class-to-student.ts
 *   npx ts-node src/utils/migrations/002-funding-source-class-to-student.ts --commit
 */

import "dotenv/config";
import { dbConnection } from "../db-connection";
import { ClassModel } from "../../model/class.model";
import { StudentModel } from "../../model/student.model";
import { logger } from "../logger";

const run = async () => {
  const isDryRun = !process.argv.includes("--commit");
  await dbConnection();
  logger.info(`[Migration 002] Starting... (${isDryRun ? "DRY RUN — pass --commit to write" : "COMMIT MODE"})`);

  // Load all classes that have a class-level fundingSourceNational
  const classes = await ClassModel.find({
    "fundDetails.fundingSourceNational": { $exists: true, $ne: "" }
  }).lean();

  // Build a map: studentId → Set of fundingSourceNational values seen across their classes
  const studentFundMap = new Map<string, Set<string>>();

  for (const cls of classes) {
    const fundValue = cls.fundDetails?.fundingSourceNational;
    if (!fundValue) continue;

    for (const enrollment of cls.enrollments ?? []) {
      const sid = enrollment.studentInfo?.id;
      if (!sid) continue;
      if (!studentFundMap.has(sid)) studentFundMap.set(sid, new Set());
      studentFundMap.get(sid)!.add(fundValue);
    }
  }

  let updated = 0;
  let skippedAlreadySet = 0;
  let skippedConflict = 0;
  let skippedNoValue = 0;

  for (const [studentId, values] of studentFundMap.entries()) {
    // eslint-disable-next-line no-await-in-loop
    const student = await StudentModel.findById(studentId);
    if (!student) continue;

    // Already has a student-level value — skip
    if (student.fundingSourceNational) {
      skippedAlreadySet += 1;
      continue;
    }

    if (values.size === 0) {
      skippedNoValue += 1;
      continue;
    }

    if (values.size > 1) {
      logger.warn(
        `  [conflict] student ${studentId}: multiple funding sources found across classes: [${[...values].join(", ")}] — manual review required`
      );
      skippedConflict += 1;
      continue;
    }

    const value = [...values][0];
    logger.info(`  [update] student ${studentId}: fundingSourceNational → "${value}"`);

    if (!isDryRun) {
      student.fundingSourceNational = value;
      // eslint-disable-next-line no-await-in-loop
      await student.save();
    }
    updated += 1;
  }

  logger.info(
    `[Migration 002] ${isDryRun ? "DRY RUN" : "Done"}. ` +
      `updated=${updated}, skipped(already-set)=${skippedAlreadySet}, ` +
      `skipped(conflict)=${skippedConflict}, skipped(no-value)=${skippedNoValue}`
  );
  process.exit(0);
};

run().catch((err) => {
  logger.error("[Migration 002] Failed", err);
  process.exit(1);
});

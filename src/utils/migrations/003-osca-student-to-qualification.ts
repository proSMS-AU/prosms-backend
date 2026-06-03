/**
 * Migration 003 — oscaIdentifier: Student.participantsIdentifiers → Qualification
 *
 * Background: oscaIdentifier was briefly accepted via the student API schema (under
 * participantsIdentifiers) before it was correctly modelled on Qualification (NAT00030A
 * pos 124–129). Any records stored under the student document need to be moved to the
 * linked Qualification document.
 *
 * Approach:
 *   - Query MongoDB directly for students that have participantsIdentifiers.oscaIdentifier
 *     (Mongoose strict mode may have dropped it, so this migration gracefully handles
 *     the case where no documents are found).
 *   - For each such student, collect the qualification IDs from their enrolled classes.
 *   - If all linked qualifications share the same oscaIdentifier, write it to each
 *     qualification that doesn't already have one.
 *   - If qualifications are ambiguous (student in multiple qualifications), log and skip.
 *   - After a successful commit, unset the student-level field.
 *
 * Safe to re-run (idempotent — qualifications that already have oscaIdentifier are
 * skipped; students with no oscaIdentifier in MongoDB are simply not matched).
 *
 * Usage:
 *   npx ts-node src/utils/migrations/003-osca-student-to-qualification.ts
 *   npx ts-node src/utils/migrations/003-osca-student-to-qualification.ts --commit
 */

import "dotenv/config";
import mongoose from "mongoose";
import { dbConnection } from "../db-connection";
import { ClassModel } from "../../model/class.model";
import { QualificationModel } from "../../model/qualification.model";
import { logger } from "../logger";

const run = async () => {
  const isDryRun = !process.argv.includes("--commit");
  await dbConnection();
  logger.info(`[Migration 003] Starting... (${isDryRun ? "DRY RUN — pass --commit to write" : "COMMIT MODE"})`);

  // Use native driver to find students where the field exists, bypassing Mongoose strict
  const db = mongoose.connection.db!;
  const studentsCol = db.collection("students");

  const studentsWithOsca = await studentsCol
    .find({ "participantsIdentifiers.oscaIdentifier": { $exists: true, $ne: "" } })
    .toArray();

  if (studentsWithOsca.length === 0) {
    logger.info("[Migration 003] No students have oscaIdentifier set — nothing to migrate.");
    process.exit(0);
  }

  logger.info(`[Migration 003] Found ${studentsWithOsca.length} student(s) with oscaIdentifier.`);

  let qualUpdated = 0;
  let skippedAlreadySet = 0;
  let skippedAmbiguous = 0;
  let studentsCleaned = 0;

  for (const student of studentsWithOsca) {
    const studentId = student._id.toString();
    const oscaCode: string = student.participantsIdentifiers?.oscaIdentifier ?? "";
    if (!oscaCode) continue;

    // Find all classes this student is enrolled in
    // eslint-disable-next-line no-await-in-loop
    const enrolledClasses = await ClassModel.find({
      "enrollments.studentInfo.id": studentId
    })
      .select("qualificationId")
      .lean();

    if (enrolledClasses.length === 0) {
      logger.warn(`  [skip] student ${studentId}: not enrolled in any class — cannot resolve qualification`);
      skippedAmbiguous += 1;
      continue;
    }

    const qualIds = [...new Set(enrolledClasses.map((c) => c.qualificationId?.toString()).filter(Boolean))];

    if (qualIds.length === 0) {
      logger.warn(`  [skip] student ${studentId}: enrolled classes have no qualificationId`);
      skippedAmbiguous += 1;
      continue;
    }

    logger.info(
      `  [student ${studentId}] oscaIdentifier="${oscaCode}" → ${qualIds.length} qualification(s): [${qualIds.join(", ")}]`
    );

    for (const qualId of qualIds) {
      // eslint-disable-next-line no-await-in-loop
      const qual = await QualificationModel.findById(qualId);
      if (!qual) continue;

      if (qual.oscaIdentifier) {
        logger.info(`    [skip] qualification ${qualId}: already has oscaIdentifier="${qual.oscaIdentifier}"`);
        skippedAlreadySet += 1;
        continue;
      }

      logger.info(`    [update] qualification ${qualId}: oscaIdentifier → "${oscaCode}"`);
      if (!isDryRun) {
        qual.oscaIdentifier = oscaCode;
        // eslint-disable-next-line no-await-in-loop
        await qual.save();
      }
      qualUpdated += 1;
    }

    // Remove the now-migrated field from the student document
    if (!isDryRun) {
      // eslint-disable-next-line no-await-in-loop
      await studentsCol.updateOne({ _id: student._id }, { $unset: { "participantsIdentifiers.oscaIdentifier": "" } });
      studentsCleaned += 1;
    }
  }

  logger.info(
    `[Migration 003] ${isDryRun ? "DRY RUN" : "Done"}. ` +
      `qualificationsUpdated=${qualUpdated}, skipped(already-set)=${skippedAlreadySet}, ` +
      `skipped(ambiguous)=${skippedAmbiguous}, studentFieldsRemoved=${studentsCleaned}`
  );
  process.exit(0);
};

run().catch((err) => {
  logger.error("[Migration 003] Failed", err);
  process.exit(1);
});

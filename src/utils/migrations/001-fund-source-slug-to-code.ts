/**
 * Migration 001 — Fund source slug → numeric code + delivery mode numeric → YNN
 *
 * Run once against production DB before deploying Phase 4 AVETMISS fixes.
 * Safe to re-run (idempotent — already-converted records are skipped).
 *
 * Usage:
 *   npx ts-node src/utils/migrations/001-fund-source-slug-to-code.ts
 */

import "dotenv/config";
import { dbConnection } from "../db-connection";
import { ClassModel } from "../../model/class.model";
import { logger } from "../logger";

const SLUG_TO_CODE: Record<string, string> = {
  "commonwealth-government": "11",
  "state-territory-government": "13",
  "state-specific-Commonwealth-funded": "15",
  "domestic-client-other-revenue": "20",
  "international-client-other-revenue-2019-only": "30",
  "international-client-onshore": "31",
  "international-client-offshore": "32",
  "revenue-from-other-rtos": "80",
  // Fallback variations seen in the wild
  "domestic-other": "20",
  onshore: "31",
  offshore: "32"
};

// Old numeric delivery mode codes → YNN composite (3 chars)
const DELIVERY_MODE_MAP: Record<string, string> = {
  "10": "YNN",
  "20": "NYN",
  "30": "NNY",
  "90": "NNN"
};

const run = async () => {
  const isDryRun = !process.argv.includes("--commit");
  await dbConnection();
  logger.info(`[Migration 001] Starting... (${isDryRun ? "DRY RUN — pass --commit to write" : "COMMIT MODE"})`);

  const classes = await ClassModel.find({});
  let fundFixed = 0;
  let modeFixed = 0;

  for (const cls of classes) {
    let changed = false;

    // Fund source slug → code
    const slug = cls.fundDetails?.fundingSourceNational;
    if (slug && SLUG_TO_CODE[slug]) {
      logger.info(`  [fund] class ${cls._id}: "${slug}" → "${SLUG_TO_CODE[slug]}"`);
      cls.fundDetails.fundingSourceNational = SLUG_TO_CODE[slug];
      fundFixed++;
      changed = true;
    }

    // Delivery mode numeric → YNN
    const mode = cls.reportingDetails?.avetmissDeliveryMode;
    if (mode && DELIVERY_MODE_MAP[mode]) {
      logger.info(`  [mode] class ${cls._id}: "${mode}" → "${DELIVERY_MODE_MAP[mode]}"`);
      cls.reportingDetails.avetmissDeliveryMode = DELIVERY_MODE_MAP[mode];
      modeFixed++;
      changed = true;
    }

    if (changed && !isDryRun) await cls.save();
  }

  logger.info(
    `[Migration 001] ${isDryRun ? "DRY RUN" : "Done"}. fundSource: ${fundFixed}, deliveryMode: ${modeFixed} would be / were fixed.`
  );
  process.exit(0);
};

run().catch((err) => {
  logger.error("[Migration 001] Failed", err);
  process.exit(1);
});

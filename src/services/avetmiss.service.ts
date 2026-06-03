/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
import archiver from "archiver";
import { PassThrough } from "stream";
import { OrganizationModel } from "../model/organization.model";
import { StudentModel } from "../model/student.model";
import { ClassModel } from "../model/class.model";
import { QualificationModel } from "../model/qualification.model";
import { UnitModel } from "../model/unit.model";
import { CloudflareService } from "./cloudflare.service";
import { AppError } from "../utils/appError";
import { CONFLICT_ERROR, DATA_NOT_FOUND, httpStatus, UNIT_COMPETENCY_MAP } from "../constants";
import { AvetmissReportModel } from "../model/avetmiss-report.model";
import { DeliveryLocationModel } from "../model/delivery-location.model";
import { GenerateAvetmissReportT } from "../schemas/avetmiss-report.schema";
import { Readable } from "stream";
import axios from "axios";
import { Response } from "express";
import { QueryBuilder } from "../utils/queryBuilder";
import { generateSequentialId } from "../utils/sequentialIdGenerator";
import AdmZip from "adm-zip";
import { importFromNatZip } from "./nat-import.service";

// ─── HELPER FUNCTIONS ──────────────────────────────────────────────────────────

/**
 * Pads an alphanumeric field: left-justified, space-padded to `length`.
 */
const padA = (value: string | null | undefined, length: number): string => {
  const str = (value ?? "").substring(0, length);
  return str.padEnd(length, " ");
};

/**
 * Pads a numeric field: right-justified, zero-padded to `length`.
 */
const padN = (value: number | string | null | undefined, length: number): string => {
  const str = String(value ?? "").substring(0, length);
  return str.padStart(length, "0");
};

/**
 * Formats a JS Date to DDMMYYYY.
 * FIX: Returns 8 spaces (not 1) for null/undefined — date fields are 8 chars wide.
 * Audit: INFO — formatDate returned 1 space for null, leaving 7 buffer positions unfilled.
 */
const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return "        "; // 8 spaces — explicit blank date
  const d = new Date(date);
  if (isNaN(d.getTime())) return "        ";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}${mm}${yyyy}`;
};

/**
 * Maps ProSMS state string (e.g. "VIC", "Victoria") to AVETMISS 2-digit state code.
 */
const getStateCode = (state: string | undefined): string => {
  const map: Record<string, string> = {
    nsw: "01",
    "new south wales": "01",
    vic: "02",
    victoria: "02",
    qld: "03",
    queensland: "03",
    sa: "04",
    "south australia": "04",
    wa: "05",
    "western australia": "05",
    tas: "06",
    tasmania: "06",
    nt: "07",
    "northern territory": "07",
    act: "08",
    "australian capital territory": "08",
    oth: "09",
    "other australian territories": "09",
    "other australian territories or dependencies": "09",
    ovs: "99",
    overseas: "99"
  };
  return map[(state ?? "").toLowerCase()] ?? "99";
};

/**
 * NAT00080 state code handling:
 * - OSPC postcode => 99 (overseas)
 * - blank/unknown state => @@ (not stated)
 */
const getClientStateCode = (state: string | undefined, postcode: string): string => {
  if ((postcode ?? "").toUpperCase() === "OSPC") return "99";
  const raw = (state ?? "").trim();
  if (!raw) return "@@";
  return getStateCode(raw);
};

/**
 * Converts AVETMISS outcome code from ProSMS code (e.g. "C") to AVETMISS 2-char code (e.g. "20").
 *
 * FIX (CRITICAL — Rule #3252 / #3251): No longer silently defaults to "70".
 * Returning "70" for a unit whose end date is in the past triggers E-3252.
 * Now throws for truly unrecognised codes so the operator can fix the data.
 */
const getOutcomeCode = (code: string): string => {
  const entry = UNIT_COMPETENCY_MAP[code as keyof typeof UNIT_COMPETENCY_MAP];
  if (!entry) {
    throw new AppError(
      httpStatus.UNPROCESSABLE_ENTITY,
      "INVALID_OUTCOME_CODE",
      `Unknown unit completion status code "${code}". Cannot default to 70 (Continuing Enrolment) — ` +
        `this would cause AVETMISS E-3252 if the activity end date is before the collection period end. ` +
        `Please map this status to a valid AVETMISS outcome code in UNIT_COMPETENCY_MAP.`
    );
  }
  return String(entry.numberCode).padStart(2, "0");
};

/**
 * Maps ProSMS employment/labour-force status strings to AVETMISS 2-digit codes.
 * FIX (HIGH — Rule #3723): employmentStatus was written raw from the DB with padN("@@"),
 * meaning ProSMS display strings like "Employed full-time" would produce invalid codes.
 * AVETMISS valid codes: 01–05 + @@
 */
const getEmploymentStatusCode = (status: string | undefined): string => {
  const map: Record<string, string> = {
    "01": "01",
    "employed-full-time": "01",
    "employed full-time": "01",
    "full-time": "01",
    fulltime: "01",
    "02": "02",
    "employed-part-time": "02",
    "employed part-time": "02",
    "part-time": "02",
    parttime: "02",
    "03": "03",
    "self-employed": "03",
    "self employed - not employing others": "03",
    "self employed": "03",
    "04": "04",
    "self employed - employing others": "04",
    "self-employed employing others": "04",
    "05": "05",
    "employed - unpaid worker in a family business": "05",
    "unpaid family worker": "05",
    "06": "06",
    unemployed: "06",
    "unemployed - seeking full-time work": "06",
    "seeking full-time": "06",
    "07": "07",
    "unemployed - seeking part-time work": "07",
    "seeking part-time": "07",
    "08": "08",
    "not employed - not seeking work": "08",
    "not in labour force": "08",
    "not-in-the-labor-force": "08",
    retired: "08",
    student: "08",
    other: "08",
    "@@": "@@",
    "not stated": "@@",
    "": "@@"
  };
  return map[(status ?? "").toLowerCase()] ?? "@@";
};

/**
 * Maps DB education level values to AVETMISS Highest School Level Completed codes.
 * FIX (CRITICAL — Rule #3740): Field was entirely absent from NAT00080 write calls.
 *
 * Source values come from highestLevelOfEducationOptions (stored as the `value` slug):
 *   "no-formal-education" | "primary-school" | "high-school" |
 *   "certificate-i-ii-iii-iv" | "diploma" | "advanced-diploma" |
 *   "bachelors-degree" | "postgraduate-degree" | "trade-qualification" | "other"
 *
 * AVETMISS valid codes:
 *   02 = Year 8 or below          03 = Year 9
 *   04 = Year 10                  05 = Year 11
 *   06 = Year 12 or equivalent    07 = Certificate I
 *   08 = Certificate II           09 = Certificate III
 *   10 = Certificate IV           11 = Diploma or Associate Diploma
 *   12 = Advanced Diploma         13 = Bachelor Degree or above
 *   @@ = Not stated / not collected
 *
 * NOTE — "high-school" maps to "06" (Year 12 equivalent) as the safest single
 * mapping for the combined "Year 10, Year 11, Year 12" label. If your data needs
 * finer granularity, split the option into separate Year 10 / Year 11 / Year 12
 * values in the UI before reporting.
 *
 * "trade-qualification" has no direct AVETMISS school-level equivalent —
 * it maps to "09" (Certificate III) which is the closest VET trade-level code.
 * Update this mapping if your operators use a different convention.
 */
const getSchoolLevelCode = (educationLevel: string | undefined): string => {
  const map: Record<string, string> = {
    // NAT00080 school-level codes per PDF: 12,11,10,09,08,02,@@
    "no-formal-education": "02",
    "primary-school": "08",
    "high-school": "12",

    // Current frontend stores post-school levels in the same field.
    // For NAT00080 this must be school level only, so fallback to not stated.
    "certificate-i-ii-iii-iv": "@@",
    diploma: "@@",
    "advanced-diploma": "@@",
    "bachelors-degree": "@@",
    "postgraduate-degree": "@@",
    "trade-qualification": "@@",
    other: "@@",

    // Numeric pass-through for legacy values
    "02": "02",
    "08": "08",
    "09": "09",
    "10": "10",
    "11": "11",
    "12": "12",

    "year 8 or below": "08",
    "year 8": "08",
    "year 9": "09",
    "year 10": "10",
    "year 11": "11",
    "year 12": "12",
    "year 12 or equivalent": "12",
    "did not go to school": "02",

    "not stated": "@@",
    "@@": "@@",
    "": "@@"
  };
  return map[(educationLevel ?? "").toLowerCase()] ?? "@@";
};

/**
 * Maps ProSMS delivery mode labels to valid 3-char AVETMISS Delivery Mode codes.
 * FIX (HIGH — Rule #3716): Was defaulting to "I" which is NOT a valid AVETMISS code.
 * The field is 3 characters (padded with trailing spaces).
 * Valid: "C  " Classroom, "E  " Electronic, "W  " Workplace, "NNN" Not applicable
 */
const getDeliveryModeCode = (mode: string | undefined): string => {
  const map: Record<string, string> = {
    // PDF-aligned NAT00120 3-char composite codes
    ynn: "YNN",
    nyn: "NYN",
    nny: "NNY",
    yyn: "YYN",
    yny: "YNY",
    nyy: "NYY",
    yyy: "YYY",
    "not applicable": "NNN",
    nnn: "NNN",

    // Current frontend option labels
    "predominantly classroom based": "YNN",
    "predominantly electronic-based": "NYN",
    "workplace - based": "NNY",
    "workplace-based": "NNY",
    "external delivery": "NYN",
    "mixed mode": "YYN",

    // Legacy single-letter storage
    c: "YNN",
    e: "NYN",
    w: "NNY"
  };

  const normalised = (mode ?? "").toLowerCase().trim();

  // Empty / not set — separate message from "unrecognised value" to make it actionable
  if (!normalised) {
    console.warn(
      `[AVETMISS] NAT00120: A class has no avetmissDeliveryMode set — defaulting to "YNN". ` +
        `Populate reportingDetails.avetmissDeliveryMode on the class to suppress this warning.`
    );
    return "YNN";
  }

  const result = map[normalised];
  if (!result) {
    console.warn(
      `[AVETMISS] NAT00120: Unrecognised delivery mode "${mode}" — defaulting to "YNN". ` +
        `Add this value to getDeliveryModeCode() map if it needs a different code.`
    );
    return "YNN";
  }
  return result;
};

const getSurveyContactStatusCode = (status: string | undefined): string => {
  const map: Record<string, string> = {
    a: "A",
    c: "C",
    d: "D",
    e: "E",
    i: "I",
    m: "M",
    o: "O",
    s: "A",
    n: "E",
    "available-for-survey": "A",
    "correctional-facility": "C",
    "deceased-student": "D",
    overseas: "O",
    "excluded-from-survey": "E",
    "minor-under-age-of-15": "M",
    "invalid-address-ltinerant-student": "I",
    "": "A"
  };

  const normalised = (status ?? "").toLowerCase().trim();
  return map[normalised] ?? "A";
};

const getFundingSourceNationalCode = (value: string | undefined): string => {
  const allowed = new Set(["11", "13", "15", "20", "30", "31", "32", "80"]);
  const raw = (value ?? "").trim();
  if (!raw) return "20";

  const normalized = raw.toLowerCase();
  if (allowed.has(raw)) return raw;

  const prefixed = normalized.match(/^(\d{2})\b/);
  if (prefixed && allowed.has(prefixed[1])) return prefixed[1];

  if (normalized.includes("domestic")) return "20";
  if (normalized.includes("offshore")) return "32";
  if (normalized.includes("onshore")) return "31";

  throw new AppError(
    httpStatus.UNPROCESSABLE_ENTITY,
    "INVALID_FUNDING_SOURCE_NATIONAL",
    `Unsupported fundingSourceNational value "${value}". Expected AVETMISS codes: 11, 13, 15, 20, 30, 31, 32, 80.`
  );
};

const getLanguageIdentifierCode = (value: string | undefined): string => {
  const raw = (value ?? "").trim();
  if (!raw) return "@@@@";

  const direct = raw.match(/^\d{4}$/)?.[0];
  if (direct) return direct;

  const normalized = raw.toLowerCase();
  const map: Record<string, string> = {
    "en-english": "1201",
    english: "1201",
    "english only": "1201"
  };

  return map[normalized] ?? "@@@@";
};

const getCountryIdentifierCode = (value: string | undefined): string => {
  const raw = (value ?? "").trim();
  if (!raw) return "@@@@";

  const direct = raw.match(/^\d{4}$/)?.[0];
  if (direct) return direct;

  const normalized = raw.toLowerCase();
  const map: Record<string, string> = {
    australia: "1101",
    "new zealand": "1201",
    "united kingdom": "2102",
    china: "6101",
    india: "7103",
    philippines: "5202",
    vietnam: "5105",
    "not stated": "@@@@",
    other: "0000"
  };

  return map[normalized] ?? "@@@@";
};

const getStudyReasonCode = (value: string | undefined): string => {
  const raw = (value ?? "").trim();
  if (!raw) return "@@";

  const direct = raw.match(/^(01|02|03|04|05|06|07|08|11|12|13|@@)$/)?.[0];
  if (direct) return direct;

  const normalized = raw.toLowerCase();
  const map: Record<string, string> = {
    "to get a job": "01",
    "to develop my existing business": "02",
    "to start my own business": "03",
    "to try for a different career": "04",
    "to get a better job or promotion": "05",
    "it was a requirement of my job": "06",
    "i wanted extra skills for my job": "07",
    "to get into another course of study": "08",
    "other reasons": "11",
    "for personal interest or self-development": "12",
    "to get skills for community/voluntary work": "13",
    "not stated": "@@"
  };

  return map[normalized] ?? "@@";
};

const getDisabilityTypeCode = (value: string | number): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "99";

  const direct = raw.match(/^(11|12|13|14|15|16|17|18|19|99)$/)?.[0];
  if (direct) return direct;

  const normalized = raw.toLowerCase();
  const map: Record<string, string> = {
    "hearing/def": "11",
    hearing: "11",
    deaf: "11",
    physical: "12",
    intellectual: "13",
    learning: "14",
    mental: "15",
    "mental illness": "15",
    "acquired brain impairment": "16",
    vision: "17",
    "medical condition": "18",
    other: "19",
    "not specified": "99"
  };

  const mapped = map[normalized];
  if (mapped) return mapped;

  throw new AppError(
    httpStatus.UNPROCESSABLE_ENTITY,
    "INVALID_DISABILITY_TYPE",
    `Unsupported disability type "${value}". Must map to one of: 11,12,13,14,15,16,17,18,19,99.`
  );
};

const formatClientDob = (date: Date | string | null | undefined): string => {
  if (!date) return "@@@@@@@@";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "@@@@@@@@";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}${mm}${yyyy}`;
};

// ─── NAT FILE GENERATORS ───────────────────────────────────────────────────────

/**
 * NAT00010 — Training Organisation
 * One record per RTO.
 *
 * FIX (CRITICAL): ANZSIC field changed from padN(0,4)="0000" to padA("",4)="    "
 *   Rule #4614: ANZSIC must be blank (spaces) if unknown, not "0000".
 * FIX (CRITICAL): Address First Line now concatenates building + unit + street
 *   Rule #3830: Address First Line must not be blank if RTO not on TGA.
 */
const generateNAT00010 = async (organizationId: string): Promise<string> => {
  const org = await OrganizationModel.findById(organizationId);
  if (!org) throw new AppError(httpStatus.NOT_FOUND, "NOT_FOUND", "Organization not found");
  const addr = org.address;

  // Build a proper Address First Line by combining building + unit + street.
  const addressFirstLine = [addr?.building, addr?.unit, addr?.street].filter(Boolean).join(" ").trim();

  const record = [
    padA(org.rtoId, 10), // Training organisation identifier
    padA(org.name, 100), // Training organisation name
    padN(20, 2), // Training organisation type identifier: 20=Private
    padA("", 4), // ANZSIC identifier — blank when unknown
    padA("", 60), // Contact name
    padA(org.phone?.number ?? "", 20), // Telephone number
    padA("", 20), // Facsimile number
    padA(org.email ?? "", 100), // Email address
    padA(addr?.building ?? "", 100), // Address building/property name
    padA("", 15), // Address street number
    padA(addressFirstLine || (addr?.street ?? ""), 100), // Address first line
    padA(addr?.POBox ?? "", 20), // Address postal delivery box
    padA(addr?.city ?? "", 50), // Address suburb, town or locality
    padN(addr?.postCode ?? "0000", 4), // Postcode
    padN(getStateCode(addr?.state), 2), // State identifier
    padA(org.website ?? "", 100), // Website address
    padA("", 8), // Organisation registration date
    padA(" ", 1) // Filler
  ].join("");
  return record + "\n";
};

/**
 * NAT00020 — Training Organisation Delivery Location
 *
 * FIX (CRITICAL): Removed "DEFAULT001" fallback — throw if location is missing (Rule #4500).
 *   A class without a valid location must not be silently masked with a phantom location ID.
 * FIX (CRITICAL): Name fallback improved — falls back to street or city if addressLine blank (Rule #3830).
 * FIX (HIGH): Assert locationId is ≤ 10 characters before writing (Rules #3802 / #3830).
 * FIX (CRITICAL): Country code now derived from postcode — OSPC postcodes get 9999, others get 1101 (Rule #4648).
 */
const generateNAT00020 = async (
  rtoId: string,
  locations: Array<{ locationId: string; name: string; city?: string; postcode?: string; state?: string }>
): Promise<string> => {
  return locations
    .map((loc) => {
      // FIX (HIGH): assert locationId length
      if (!loc.locationId || loc.locationId.length > 10) {
        throw new AppError(
          httpStatus.UNPROCESSABLE_ENTITY,
          "INVALID_LOCATION_ID",
          `Location identifier "${loc.locationId}" is ${loc.locationId?.length ?? 0} characters — ` +
            `must be 1–10 characters (Rule #3802).`
        );
      }

      // FIX (CRITICAL): Name must not be blank — fall back through available fields
      const locationName = (loc.name || loc.city || "").trim();
      if (!locationName) {
        throw new AppError(
          httpStatus.UNPROCESSABLE_ENTITY,
          "INVALID_LOCATION_NAME",
          `Delivery location "${loc.locationId}" has no name, city, or addressLine. ` +
            `Training Organisation Delivery Location Name must not be blank (Rule #3830).`
        );
      }

      const postcode = (loc.postcode ?? "").trim().toUpperCase();
      if (!postcode) {
        throw new AppError(
          httpStatus.UNPROCESSABLE_ENTITY,
          "INVALID_LOCATION_POSTCODE",
          `Delivery location "${loc.locationId}" has no postcode. NAT00020 postcode is mandatory.`
        );
      }

      // FIX (CRITICAL): Derive country from postcode — overseas postcode → 9999 (not Australian)
      const isOverseas = postcode === "OSPC";
      const countryCode = isOverseas ? 9999 : 1101;
      const stateCode = isOverseas ? "99" : getStateCode(loc.state);
      if (!isOverseas && !loc.city?.trim()) {
        throw new AppError(
          httpStatus.UNPROCESSABLE_ENTITY,
          "INVALID_LOCATION_SUBURB",
          `Delivery location "${loc.locationId}" must have suburb/city when postcode is not OSPC.`
        );
      }

      return (
        [
          padA(rtoId, 10), // Pos   1–10 : Training org identifier      (10, A)
          padA(loc.locationId, 10), // Pos  11–20 : Location identifier          (10, A)
          padA(locationName, 100), // Pos  21–120: Location name                (100, A)
          padA(postcode, 4), // Pos 121–124: Postcode                     ( 4, A) ← alphanumeric per spec
          padA(stateCode, 2), // Pos 125–126: State identifier             ( 2, A)
          padA(loc.city ?? "", 50), // Pos 127–176: Address suburb/locality/town (50, A)
          padN(countryCode, 4) // Pos 177–180: Country identifier           ( 4, N)
        ].join("") + "\n"
      );
    })
    .join("");
};

/**
 * NAT00030A — Program File (Qualifications)
 * One record per unique qualification referenced in NAT00120 within the date range.
 *
 * Record layout (130 chars):
 *   Pos   1–10  : Program identifier          (10, A)
 *   Pos  11–110 : Program name                (100, A)
 *   Pos 111–114 : Total nominal hours         (4, N)
 *   Pos 115–123 : Reserved / blank            (9)
 *   Pos 124–129 : OSCA identifier             (6, A) — Release 8.1, replaces ANZSCO
 *   Pos 130     : Blank                       (1)
 *
 * FIX (MEDIUM): Logs a warning if nominalHours is null/undefined (Rule #3401 warning).
 */
const generateNAT00030 = async (qualificationIds: string[]): Promise<string> => {
  const safeIds = qualificationIds
    .map((id) => (typeof id === "object" ? (id as any)?._id?.toString() : id))
    .filter(Boolean);

  const quals = await QualificationModel.find({ _id: { $in: safeIds } });
  return quals
    .map((qual) => {
      if (qual.nominalHours == null) {
        console.warn(
          `[AVETMISS] NAT00030A: Qualification "${qual.code}" has no nominalHours — ` +
            `writing "0000". This will trigger NCVER warning #3401.`
        );
      }
      const base = padA(qual.code, 10) + padA(qual.title, 100) + padN(qual.nominalHours ?? 0, 4);
      // Pad to pos 123 (9 reserved blank chars), then write OSCA at pos 124–129
      const line = base.padEnd(123, " ") + padA(qual.oscaIdentifier ?? "", 6).padEnd(7, " ");
      return `${line}\n`;
    })
    .join("");
};

/**
 * NAT00060 — Subject File (Units of Competency)
 *
 * FIX (CRITICAL — Rule #3720): fieldOfEducationId fallback changed from "000000" to spaces.
 *   "000000" ends in "0" and fails E-3720. Blank spaces let NCVER skip the validation for
 *   TGA-listed units. Custom units with no FOE code should set one before submission.
 * FIX (CRITICAL — Rule #3004): VET Flag field added to record layout.
 *   The field was entirely missing. Position 123: "Y" = VET unit.
 * FIX (HIGH — Rule #4723): Unit hour now validated — must not exceed 1500.
 */
const generateNAT00060 = async (unitCodes: string[], organizationId: string): Promise<string> => {
  if (!unitCodes?.length) return "";

  const uniqueCodes = [...new Set(unitCodes)];

  const units = await UnitModel.find({
    code: { $in: uniqueCodes },
    organizationId
  }).lean();

  const foundCodes = new Set(units.map((u) => u.code));
  const missingCodes = uniqueCodes.filter((c) => !foundCodes.has(c));
  if (missingCodes.length) {
    const fallbackUnits = await UnitModel.find({ code: { $in: missingCodes } }).lean();
    units.push(...fallbackUnits);
  }

  const unitMap = new Map(units.map((u) => [u.code, u]));

  const stillMissing = uniqueCodes.filter((code) => !unitMap.has(code));
  if (stillMissing.length) {
    throw new Error(`NAT00060 generation failed. Missing unit definitions for: ${stillMissing.join(", ")}`);
  }

  const orderedUnits = uniqueCodes.map((code) => unitMap.get(code)!).sort((a, b) => a.code.localeCompare(b.code));

  return orderedUnits
    .map((unit) => {
      // FIX (HIGH): validate nominal hours ≤ 1500
      if ((unit.hour ?? 0) > 1500) {
        throw new AppError(
          httpStatus.UNPROCESSABLE_ENTITY,
          "INVALID_UNIT_HOURS",
          `Unit "${unit.code}" has nominal hours ${unit.hour} which exceeds the AVETMISS maximum of 1500 (Rule #4723).`
        );
      }

      // FIX (CRITICAL): Use spaces for unknown fieldOfEducationId, not "000000"
      // "000000" ends in "0" → triggers E-3720.
      // Blank (6 spaces) → NCVER skips FOE validation for TGA-listed units.
      const foeId =
        unit.fieldOfEducationId && unit.fieldOfEducationId !== "000000" ? padN(unit.fieldOfEducationId, 6) : "      "; // 6 spaces

      const line = [
        padA(unit.code, 12), // Pos   1–12 : Subject identifier      (12, A)
        padA(unit.title, 100), // Pos  13–112: Subject name             (100, A)
        foeId, // Pos 113–118: Subject FOE identifier   (6, A) spaces if unknown
        padA((unit as any).vetFlag ?? "Y", 1), // Pos 119    : VET flag — "Y" for VET units, "N" for non-vocational
        padN(unit.hour ?? 0, 4) // Pos 120–123: Nominal hours            (4, N)
      ].join("");
      return line + "\n";
    })
    .join("");
};

/**
 * NAT00080 — Client File (Students)
 * Record length: 327 characters (for RTOs submitting directly).
 *
 * Field layout confirmed from ACT AVETMISS Data Standard v2.03 / NCVER 8.0 spec:
 *
 *   Pos   1–10  : Client identifier                (10, A)
 *   Pos  11–70  : Name for encryption              (60, A)  ← "FAMILYNAME,FIRSTNAME" truncated to 60
 *   Pos  71–72  : Highest school level completed   ( 2, A)
 *   Pos  73     : Gender                           ( 1, A)
 *   Pos  74–81  : Date of birth                    ( 8, D)
 *   Pos  82–85  : Postcode                         ( 4, A)  ← alphanumeric (OSPC allowed)
 *   Pos  86     : Indigenous status identifier     ( 1, A)
 *   Pos  87–90  : Language identifier              ( 4, N)
 *   Pos  91–92  : Labour force status identifier   ( 2, A)  ← "@@" is valid not-stated
 *   Pos  93–96  : Country identifier               ( 4, A)
 *   Pos  97     : Disability flag                  ( 1, A)
 *   Pos  98     : Prior educational achievement flag( 1, A)
 *   Pos  99     : At school flag                   ( 1, A)
 *   Pos 100–149 : Address — suburb, locality, town (50, A)
 *   Pos 150–159 : Unique student identifier        (10, A)
 *   Pos 160–161 : State identifier                 ( 2, N)
 *   Pos 162–211 : Address building/property name   (50, A)
 *   Pos 212–241 : Address flat/unit details        (30, A)
 *   Pos 242–256 : Address street number            (15, A)
 *   Pos 257–326 : Address street name              (70, A)
 *   Pos 327     : Survey contact status            ( 1, A)
 */
const generateNAT00080 = async (studentIds: string[], collectionEndDate: Date): Promise<string> => {
  if (!studentIds?.length) return "";

  const students = await StudentModel.find({ _id: { $in: studentIds } }).lean();

  const genderMap: Record<string, string> = {
    m: "M",
    male: "M",
    f: "F",
    female: "F",
    x: "X",
    other: "X",
    others: "X"
  };

  const indigenousMap: Record<string, string> = {
    aboriginal: "1",
    "yes-aboriginal": "1",
    "torres strait islander": "2",
    "yes-torres-strait-islander": "2",
    "both aboriginal and torres strait islander": "3",
    "yes-both": "3",
    no: "4",
    neither: "4",
    "not stated": "@",
    "": "@"
  };

  // Error #3811: deduplicate by avetmissId
  const seenClientIds = new Set<string>();
  const lines: string[] = [];

  for (const student of students) {
    const vet = student.vetDetails;
    const addr = student.address?.primaryPostalAddress;

    // FIX (HIGH): Trim avetmissId — must not contain spaces (Rule #4619)
    const avetmissId = (student.avetmissId ?? "").trim();

    // Skip students without a valid avetmissId — prevents Error #4503
    if (!avetmissId) {
      console.warn(`[AVETMISS] NAT00080: Student "${String(student._id)}" has no avetmissId — skipping.`);
      continue;
    }

    // Error #3811: only one record per Client Identifier
    if (seenClientIds.has(avetmissId)) {
      console.warn(`[AVETMISS] NAT00080: Duplicate avetmissId "${avetmissId}" — skipping duplicate.`);
      continue;
    }
    seenClientIds.add(avetmissId);

    // FIX (HIGH): Guard — client ID must not equal USI (Rule #4730)
    const usi = (student.participantsIdentifiers?.USI ?? "").trim();
    if (avetmissId && usi && avetmissId === usi) {
      throw new AppError(
        httpStatus.UNPROCESSABLE_ENTITY,
        "CLIENT_ID_EQUALS_USI",
        `Student "${avetmissId}": Client Identifier must not be identical to USI (Rule #4730).`
      );
    }

    // Warning #4746: USI should not be blank
    if (!usi) {
      console.warn(`[AVETMISS] NAT00080: Student "${avetmissId}" has no USI — Warning #4746.`);
    }

    // Name for Encryption: "FAMILYNAME,FIRSTNAME" — max 60 chars (Rule #3853)
    const rawName = `${(student.personalInfo?.surname ?? "").toUpperCase()},${(student.personalInfo?.givenName ?? "").toUpperCase()}`;
    const nameForEncryption = rawName.substring(0, 60);

    const schoolLevel = getSchoolLevelCode(vet?.educationLevel); // "@@" if not set
    const gender = genderMap[(student.personalInfo?.gender ?? "").toLowerCase()] ?? "X";
    const dob = formatClientDob(student.personalInfo?.dateOfBirth);

    // DOB validation, age-based flag derivations (Rules #3835, #3201, #3840)
    let atSchoolFlag = vet?.atSchool === true ? "Y" : vet?.atSchool === false ? "N" : "@";
    if (dob !== "@@@@@@@@") {
      const dobYear = parseInt(dob.substring(4, 8));
      const collectionYear = collectionEndDate.getFullYear();
      if (dobYear >= collectionYear) {
        console.warn(
          `[AVETMISS] NAT00080: Student "${avetmissId}" DOB year ${dobYear} >= collection year ${collectionYear} — Rule #3835.`
        );
      }
      const dobDate = new Date(dobYear, parseInt(dob.substring(2, 4)) - 1, parseInt(dob.substring(0, 2)));
      const ageYears = (collectionEndDate.getTime() - dobDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (ageYears < 10) {
        console.warn(
          `[AVETMISS] NAT00080: Student "${avetmissId}" age ${ageYears.toFixed(1)} < 10 at collection end — Rule #3201.`
        );
      }
      // Warning #3840: auto-set At School Flag to Y when age < 15
      if (ageYears < 15 && atSchoolFlag !== "Y") {
        console.warn(
          `[AVETMISS] NAT00080: Student "${avetmissId}" age ${ageYears.toFixed(1)} < 15 — auto-setting At School Flag to Y (Rule #3840).`
        );
        atSchoolFlag = "Y";
      }
    }

    // FIX (Error #3705): validate postcode — must be 4-digit numeric, "OSPC", or "@@@@"
    const rawPostcode = (addr?.postCode ?? "").trim();
    let postcode = /^\d{4}$/.test(rawPostcode) ? rawPostcode : rawPostcode.toUpperCase() === "OSPC" ? "OSPC" : "@@@@";

    // Funding codes 31 (international+onshore) and 32 (international+offshore) always
    // report OSPC/99 regardless of the real stored address (AVETMISS spec).
    const studentFundingCode = (student.fundingSourceNational ?? "").trim();
    if (studentFundingCode === "31" || studentFundingCode === "32") {
      postcode = "OSPC";
    }

    // ADDR-VAL: domestic funding codes (11/13/15/20) cannot have an overseas address.
    // These students are Australian-funded — OSPC postcode is a data entry error.
    const DOMESTIC_CODES = ["11", "13", "15", "20"];
    if (DOMESTIC_CODES.includes(studentFundingCode) && postcode === "OSPC") {
      console.warn(
        `[AVETMISS] NAT00080: Student "${avetmissId}" has domestic funding code "${studentFundingCode}" ` +
          `but postcode is OSPC — this is a data error. Domestic students must have a real AU address. ` +
          `Reporting OSPC as-is; please correct the student record.`
      );
    }

    const indigenous = indigenousMap[((vet?.abOriginalOrigin as string) ?? "").toLowerCase()] ?? "@";
    const language = getLanguageIdentifierCode(vet?.language);
    const labourForce = getEmploymentStatusCode(vet?.employmentStatus); // "@@" if not set
    const birthCountry = getCountryIdentifierCode(vet?.birthCountry);
    const disabilityFlag = vet?.disabilities === true ? "Y" : vet?.disabilities === false ? "N" : "@";
    // FIX (Error #4001/#4016): priorEdFlag=Y only when achievements with non-empty codes exist (consistent with NAT-100 output)
    const achievements = (vet?.priorEducationalAchievements ?? []).filter((a: any) => (a?.code ?? "").trim());
    const priorEdFlag = achievements.length > 0 ? "Y" : vet?.priorEducation === false ? "N" : "@";
    const suburb = (addr?.city ?? "").substring(0, 50);
    // stateCode must be "99" when postcode is OSPC (overseas)
    const stateCode = postcode === "OSPC" ? "99" : getClientStateCode(addr?.state, postcode);
    const building = (addr?.building ?? "").substring(0, 50);
    const unit = (addr?.unit ?? "").substring(0, 30);
    const streetNumber = (addr?.streetNumber ?? "").toString().substring(0, 15);
    const streetName = ((addr?.streetName ?? addr?.street ?? "").trim() || "not specified").substring(0, 70);
    const surveyStatus = getSurveyContactStatusCode(vet?.surveyContactStatus);

    const record = " ".repeat(327).split("");

    // write(value, 1-based-position, length) — converts to 0-indexed internally
    const write = (pos: number, len: number, value: string) => {
      const str = (value ?? "").substring(0, len).padEnd(len, " ");
      for (let i = 0; i < len; i++) record[pos - 1 + i] = str[i];
    };

    write(1, 10, avetmissId); // Client identifier
    write(11, 60, nameForEncryption); // Name for encryption
    write(71, 2, schoolLevel); // Highest school level completed
    write(73, 1, gender); // Gender
    write(74, 8, dob); // Date of birth
    write(82, 4, postcode); // Postcode (alphanumeric — OSPC allowed)
    write(86, 1, indigenous); // Indigenous status
    write(87, 4, language); // Language identifier
    write(91, 2, labourForce); // Labour force status ("@@" = not stated)
    write(93, 4, birthCountry); // Country identifier
    write(97, 1, disabilityFlag); // Disability flag
    write(98, 1, priorEdFlag); // Prior educational achievement flag
    write(99, 1, atSchoolFlag); // At school flag
    write(100, 50, suburb); // Address — suburb, locality or town
    write(150, 10, usi); // Unique student identifier
    write(160, 2, stateCode); // State identifier (@@ allowed for not-stated)
    write(162, 50, building); // Address building/property name
    write(212, 30, unit); // Address flat/unit details
    write(242, 15, streetNumber); // Address street number
    write(257, 70, streetName); // Address street name
    write(327, 1, surveyStatus); // Survey contact status

    lines.push(record.join("") + "\n");
  }

  return lines.join("");
};

/**
 * NAT00085 — Client Postal Details File
 *
 * Field layout confirmed from ACT AVETMISS Data Standard docx (v2.03):
 *   Pos   1–10  : Client identifier              (10, A)
 *   Pos  11–14  : Client title                   ( 4, A)
 *   Pos  15–54  : Client first given name        (40, A)
 *   Pos  55–94  : Client last name               (40, A) ← NO "second given name" in spec
 *   Pos  95–144 : Address building/property name (50, A)
 *   Pos 145–174 : Address flat/unit details      (30, A)
 *   Pos 175–189 : Address street number          (15, A)
 *   Pos 190–259 : Address street name            (70, A)
 *   Pos 260–281 : Address postal delivery box    (22, A)
 *   Pos 282–331 : Address suburb/locality/town   (50, A)
 *   Pos 332–335 : Postcode                       ( 4, A)
 *   Pos 336–337 : State identifier               ( 2, N)
 *   Pos 338–357 : Telephone number — home        (20, A)
 *   Pos 358–377 : Telephone number — work        (20, A)
 *   Pos 378–397 : Telephone number — mobile      (20, A)
 *   Pos 398–477 : Email address                  (80, A)
 *   Pos 478–557 : Email address (alternative)    (80, A)
 *   Record length = 557
 */
const generateNAT00085 = async (studentIds: string[]): Promise<string> => {
  const students = await StudentModel.find({ _id: { $in: studentIds } });

  const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const sanitizePhone = (phone: string | undefined): string => (phone ?? "").replace(/[^0-9+\- ]/g, "").trim();

  const seenClientIds = new Set<string>();
  const lines: string[] = [];

  for (const student of students) {
    const avetmissId = (student.avetmissId ?? "").trim();

    // Skip students without avetmissId — ensures consistency with NAT-80
    if (!avetmissId) {
      console.warn(`[AVETMISS] NAT00085: Student "${String(student._id)}" has no avetmissId — skipping.`);
      continue;
    }

    // Deduplicate by avetmissId
    if (seenClientIds.has(avetmissId)) {
      console.warn(`[AVETMISS] NAT00085: Duplicate avetmissId "${avetmissId}" — skipping.`);
      continue;
    }
    seenClientIds.add(avetmissId);

    const addr = student.address?.primaryPostalAddress;
    const contact = student.contactDetails;

    // Surname validation (Rule #4637)
    const surname = student.personalInfo?.surname ?? "";
    if (!surname.trim()) {
      throw new AppError(
        httpStatus.UNPROCESSABLE_ENTITY,
        "INVALID_SURNAME",
        `Student "${avetmissId}": Client Last Name must not be blank (Rule #4637).`
      );
    }
    if (/\d/.test(surname)) {
      throw new AppError(
        httpStatus.UNPROCESSABLE_ENTITY,
        "INVALID_SURNAME",
        `Student "${avetmissId}": Client Last Name must not contain digits (Rule #4637).`
      );
    }

    // Street / PO Box logic (Rule #3837):
    // Street name must not be blank unless postal delivery box is populated
    const streetValue = (addr?.streetName ?? addr?.street ?? "").trim();
    const poBoxValue = (addr?.POBox ?? "").trim();
    const streetName = streetValue || (poBoxValue ? "" : "not specified");
    const postalBox = !streetValue ? poBoxValue : ""; // only write box when no street

    // FIX (Error #3705/#3706): validate postcode — must be 4-digit numeric, "OSPC", or "@@@@"
    const rawPostcode85 = (addr?.postCode ?? "").trim();
    const postcode85 = /^\d{4}$/.test(rawPostcode85)
      ? rawPostcode85
      : rawPostcode85.toUpperCase() === "OSPC"
        ? "OSPC"
        : "@@@@";

    // Email validation (Rule #4635): blank if malformed
    const emailRaw = contact?.email ?? "";
    const emailValue = isValidEmail(emailRaw) ? emailRaw : "";
    if (emailRaw && !emailValue) {
      console.warn(`[AVETMISS] NAT00085: Student "${avetmissId}" invalid email — blanked.`);
    }
    const altEmailRaw = contact?.alternateEmail ?? "";
    const altEmailValue = isValidEmail(altEmailRaw) ? altEmailRaw : "";

    // Warning #4630: suburb must be on AusPost listing (data quality — cannot fix in code)
    if (!(addr?.city ?? "").trim()) {
      console.warn(`[AVETMISS] NAT00085: Student "${avetmissId}" has blank suburb — warn #4630.`);
    }
    // Warning #3833: street number should not be blank when street name exists
    if (streetValue && !(addr?.streetNumber ?? "").toString().trim()) {
      console.warn(
        `[AVETMISS] NAT00085: Student "${avetmissId}" has street name but blank street number — warn #3833.`
      );
    }

    // Record buffer: 557 chars (field data sum per docx spec table)
    const buf = " ".repeat(557).split("");
    const write = (pos: number, len: number, value: string) => {
      const str = (value ?? "").substring(0, len).padEnd(len, " ");
      for (let i = 0; i < len; i++) buf[pos - 1 + i] = str[i];
    };

    write(1, 10, avetmissId); // Client identifier
    write(11, 4, student.personalInfo?.title ?? ""); // Client title
    write(15, 40, student.personalInfo?.givenName ?? ""); // Client first given name
    write(55, 40, surname); // Client last name (NO middle name field)
    write(95, 50, addr?.building ?? ""); // Address building/property name
    write(145, 30, addr?.unit ?? ""); // Address flat/unit details
    write(175, 15, (addr?.streetNumber ?? "").toString().substring(0, 15)); // Address street number
    write(190, 70, streetName); // Address street name
    write(260, 22, postalBox); // Address postal delivery box
    write(282, 50, addr?.city ?? ""); // Address suburb/locality/town
    write(332, 4, postcode85); // Postcode (alphanumeric — OSPC/@@@@ allowed)
    write(336, 2, getClientStateCode(addr?.state, postcode85)); // State identifier
    write(338, 20, sanitizePhone(contact?.personalPhone?.number)); // Telephone — home
    write(358, 20, sanitizePhone(contact?.workPhone?.number)); // Telephone — work
    write(378, 20, ""); // Telephone — mobile (not in model)
    write(398, 80, emailValue); // Email address
    write(478, 80, altEmailValue); // Email address (alternative)

    lines.push(buf.join("") + "\n");
  }

  return lines.join("");
};

/**
 * NAT00090 — Disability File
 * One record per disability type per student with disability flag = Y.
 */
const generateNAT00090 = async (studentIds: string[]): Promise<string> => {
  const students = await StudentModel.find({
    _id: { $in: studentIds },
    "vetDetails.disabilities": true
  });
  const lines: string[] = [];
  for (const student of students) {
    const types = student.vetDetails?.disabilityTypes ?? [];
    if (types.length === 0) {
      lines.push(padA(student.avetmissId, 10) + padN(99, 2) + "\n");
    } else {
      for (const type of types) {
        lines.push(padA(student.avetmissId, 10) + padA(getDisabilityTypeCode(type as string | number), 2) + "\n");
      }
    }
  }
  return lines.join("");
};

/**
 * NAT00100 — Prior Educational Achievement File
 *
 * One record per prior educational achievement type per student.
 * Generated for every student in NAT00120 who has entries in
 * `vet.priorEducationalAchievements`.
 *
 * Record layout confirmed from ACT AVETMISS Data Standard v2.03 / NCVER 8.0 spec:
 *   Pos  1–10 : Client Identifier                      (10, A) left-justified, space-padded
 *   Pos 11–13 : Prior Educational Achievement Type     ( 3, N) right-justified, zero-padded
 *   Record length = 13 characters (+ CRLF)
 *
 * NOTE: There is NO "Year Completed" field in NAT00100 per AVETMISS 8.0.
 *   The completedYear stored on PriorEducationalAchievement is for internal
 *   reference only and is NOT written to this file.
 *
 * Example output (matches NCVER sample files):
 *   CLIENT002 511
 *   CLIENT003 990
 *
 * Rules:
 *   • Client must exist in NAT00080 (guaranteed — we source from nat120Result.studentIds).
 *   • NAT00080 Prior Educational Achievement Flag must be "Y" for the same client —
 *     this is enforced by `vet.priorEducation === true` on the Student record.
 *   • Duplicate (clientId + code) combinations are skipped (warn + continue).
 *   • Code must be a valid AVETMISS 3-digit type (VALID_PRIOR_ED_CODES). Throws if invalid.
 *   • Students with no achievements array are silently skipped (no record needed).
 */

// Valid NAT00100 prior educational achievement type codes per AVETMISS 8.0
const VALID_PRIOR_ED_CODES = new Set([
  "008",
  "410",
  "420",
  "511",
  "514",
  "521",
  "524",
  "990",
  // Legacy values kept for backward compatibility
  "011",
  "014",
  "020",
  "021",
  "030",
  "040",
  "050",
  "060",
  "070",
  "080",
  "090",
  "527",
  "991"
]);

const generateNAT00100 = async (studentIds: string[]): Promise<string> => {
  if (!studentIds?.length) return "";

  // Same query pattern as generateNAT00080 — Mongoose auto-casts string IDs for _id $in
  const students = await StudentModel.find({ _id: { $in: studentIds } }).lean();

  const lines: string[] = [];
  const seen = new Set<string>(); // dedup: (clientId|code)

  for (const student of students) {
    const achievements = student.vetDetails?.priorEducationalAchievements ?? [];
    if (!achievements.length) continue; // no prior achievements → no record

    const clientId = (student.avetmissId ?? "").trim();
    if (!clientId) {
      console.warn(
        `[AVETMISS] NAT00100: Student "${student._id}" has no avetmissId — skipping prior achievement records.`
      );
      continue;
    }

    for (const achievement of achievements) {
      const code = (achievement.code ?? "").trim();

      // Validate against known AVETMISS codes (Rule #3741)
      if (!VALID_PRIOR_ED_CODES.has(code)) {
        throw new AppError(
          httpStatus.UNPROCESSABLE_ENTITY,
          "INVALID_PRIOR_ED_CODE",
          `Student "${clientId}": Prior Educational Achievement code "${code}" is not a valid ` +
            `AVETMISS 3-digit type identifier (Rule #3741). ` +
            `Valid codes: ${Array.from(VALID_PRIOR_ED_CODES).join(", ")}.`
        );
      }

      const dedupKey = `${clientId}|${code}`;
      if (seen.has(dedupKey)) {
        console.warn(`[AVETMISS] NAT00100: Skipping duplicate — client="${clientId}" code="${code}"`);
        continue;
      }
      seen.add(dedupKey);

      // Record: 13 chars — Client Identifier (10) + Achievement Type (3)
      // NO year field in AVETMISS 8.0 NAT00100
      lines.push(
        padA(clientId, 10) + // Pos  1–10: Client Identifier (left-justified, space-padded)
          padN(code, 3) + // Pos 11–13: Prior Ed Achievement Type (right-justified, zero-padded)
          "\n"
      );
    }
  }

  return lines.join("");
};

/**
 * NAT00120 — Training Activity File (core enrolment file)
 *
 * FIX (CRITICAL — Rule #4693): Duplicate record detection added.
 *   Key: {rtoId}-{clientId}-{unitCode}-{qualCode}-{startDate}. Duplicate lines are skipped.
 * FIX (CRITICAL — Rule #3213): Activity End Date must not be blank.
 *   If activityEnd is null, falls back to class end date. Throws if still null.
 * FIX (HIGH — Rule #3742): fundNational default changed from "30" to "20".
 *   "30" = Overseas client — only valid with OSPC postcode. "20" = fee-for-service domestic.
 * FIX (HIGH — Rule #3716): deliveryMode mapped via getDeliveryModeCode().
 *   "I" is not a valid AVETMISS delivery mode code.
 * FIX (CRITICAL): "DEFAULT001" fallback removed — throws if class has no valid location.
 */
const generateNAT00120 = async (
  organizationId: string,
  rtoId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  content: string;
  studentIds: Set<string>;
  qualificationIds: Set<string>;
  unitCodes: Set<string>;
  locationMap: Map<string, { locationId: string; name: string; city?: string; postcode?: string; state?: string }>;
}> => {
  const classes = await ClassModel.find({
    organizationId,
    "enrollments.unitsOfCompetency.classStartDate": { $lte: endDate },
    "enrollments.unitsOfCompetency.classEndDate": { $gte: startDate }
  })
    .populate("qualificationId")
    .lean();

  await ClassModel.populate(classes, [
    { path: "classDetails.location", model: "Location" },
    { path: "deliveryLocationId", model: "DeliveryLocation" }
  ]);

  const lines: string[] = [];
  const studentIds = new Set<string>();
  const qualificationIds = new Set<string>();
  const unitCodes = new Set<string>();
  const locationMap = new Map<
    string,
    { locationId: string; name: string; city?: string; postcode?: string; state?: string }
  >();

  // FIX (CRITICAL — Rule #4693): Deduplication set
  // Key format: "{rtoId}|{clientId}|{unitCode}|{qualCode}|{startDateDDMMYYYY}"
  const seenRecords = new Set<string>();

  // R-05: Precompute first enrollment date per (studentId, qualificationId) to derive commencing code.
  // A student gets "3" (commencing) on their earliest class for a qual; "4" (continuing) on subsequent ones.
  const studentQualFirstDate = new Map<string, number>();
  for (const cls of classes) {
    const qualId = (cls.qualificationId as any)?._id?.toString() ?? "";
    const clsStart = new Date(cls.classDetails?.startDate).getTime();
    for (const enr of cls.enrollments ?? []) {
      const key = `${enr.studentInfo?.id}:${qualId}`;
      const existing = studentQualFirstDate.get(key);
      if (!existing || clsStart < existing) studentQualFirstDate.set(key, clsStart);
    }
  }

  for (const cls of classes) {
    if (cls.reportingDetails?.doNotReport) continue;

    const qual = cls.qualificationId as any;
    // Prefer new DeliveryLocation (R-15) over old Location model when available
    const delivLoc = (cls as any).deliveryLocationId as any;
    const legacyLoc = cls.classDetails?.location as any;

    let locationId: string;
    if (delivLoc && delivLoc.locationIdentifier) {
      locationId = delivLoc.locationIdentifier;
      if (!locationMap.has(locationId)) {
        locationMap.set(locationId, {
          locationId: delivLoc.locationIdentifier,
          name: delivLoc.name ?? "",
          city: delivLoc.city,
          postcode: delivLoc.postcode,
          state: delivLoc.state
        });
      }
    } else if (legacyLoc && legacyLoc.locationId) {
      locationId = legacyLoc.locationId;
      if (!locationMap.has(locationId)) {
        locationMap.set(locationId, {
          locationId: legacyLoc.locationId,
          name: legacyLoc.addressLine ?? "",
          city: legacyLoc.city,
          postcode: legacyLoc.postcode,
          state: legacyLoc.state
        });
      }
    } else {
      throw new AppError(
        httpStatus.UNPROCESSABLE_ENTITY,
        "MISSING_LOCATION",
        `Class "${(cls as any)._id}" has no valid delivery location. ` +
          `Every class must have a delivery location or legacy location before AVETMISS reporting (Rule #4011).`
      );
    }

    const loc = locationMap.get(locationId)!;

    // FIX (HIGH): default from "30" (overseas) to "20" (fee-for-service domestic)
    const fundNational = getFundingSourceNationalCode(cls.fundDetails?.fundingSourceNational);
    const fundState = cls.fundDetails?.fundingSourceState ?? " ";
    const specificFundingIdentifier = (cls.fundDetails as any)?.specificFundingIdentifier?.trim?.() ?? "";

    if (fundNational === "31" && String(loc.postcode ?? "").toUpperCase() === "OSPC") {
      throw new AppError(
        httpStatus.UNPROCESSABLE_ENTITY,
        "INVALID_FUNDING_LOCATION_COMBINATION",
        `Class "${(cls as any)._id}" has Funding Source National "31" (international onshore) ` +
          `but delivery location postcode is OSPC. Rule #4765 requires non-OSPC postcode for code 31.`
      );
    }

    if (fundNational === "13") {
      if (!specificFundingIdentifier) {
        throw new AppError(
          httpStatus.UNPROCESSABLE_ENTITY,
          "MISSING_SPECIFIC_FUNDING_IDENTIFIER",
          `Class "${(cls as any)._id}" uses Funding Source National "13". ` +
            `Specific Funding Identifier (NAT00120 pos 100-109) is mandatory.`
        );
      }
    }

    const vetInSchools = cls.classDetails?.vetInSchool ? "Y" : "N";

    for (const enrollment of cls.enrollments ?? []) {
      studentIds.add(enrollment.studentInfo.id);
      if ((qual as any)?._id) qualificationIds.add((qual as any)._id.toString());

      for (const unit of enrollment.unitsOfCompetency ?? []) {
        const activityStart = unit.unitStartDate ?? unit.classStartDate;
        let activityEnd = unit.unitEndDate ?? unit.classEndDate;

        if (!activityStart || new Date(activityStart) > endDate) continue;
        if (activityEnd && new Date(activityEnd) < startDate) continue;

        // FIX (CRITICAL — Rule #3213): Activity End Date must not be blank
        if (!activityEnd) {
          // Fall back to class end date
          activityEnd = unit.classEndDate;
          if (!activityEnd) {
            throw new AppError(
              httpStatus.UNPROCESSABLE_ENTITY,
              "MISSING_ACTIVITY_END_DATE",
              `Unit "${unit.code}" for student "${enrollment.studentInfo.id}" has no end date ` +
                `and no class end date fallback. Activity End Date must not be blank (Rule #3213).`
            );
          }
          console.warn(
            `[AVETMISS] NAT00120: Unit "${unit.code}" student "${enrollment.studentInfo.id}" ` +
              `has null unitEndDate — falling back to classEndDate.`
          );
        }

        unitCodes.add(unit.code);

        const student = await StudentModel.findById(enrollment.studentInfo.id).select(
          "avetmissId doNotReportAvetmiss fundingSourceNational isApprentice"
        );
        const clientId = (student?.avetmissId ?? "").trim();
        if (!clientId) {
          console.warn(
            `[AVETMISS] NAT00120: Student "${enrollment.studentInfo.id}" has no avetmissId — skipping unit "${unit.code}" (Error #4007).`
          );
          continue;
        }

        // R-11: Per-student AVETMISS opt-out
        if ((student as any)?.doNotReportAvetmiss) continue;

        // FIX (CRITICAL — Rule #3252 / #3251): getOutcomeCode now throws for unknown codes
        let outcomeCode = getOutcomeCode(unit.statusOfCompletion);

        // FIX (Rule #3251): if activityEnd is after collection period end, override final outcome to "70"
        if (new Date(activityEnd) > endDate && outcomeCode !== "70") {
          console.warn(
            `[AVETMISS] NAT00120: Unit "${unit.code}" student "${clientId}" outcome "${outcomeCode}" ` +
              `overridden to "70" because activityEnd ${formatDate(activityEnd)} is after collection end (Rule #3251).`
          );
          outcomeCode = "70";
        }

        // Warning (Rule #3253): activity duration must not exceed 5 years
        const fiveYearsMs = 5 * 365.25 * 24 * 60 * 60 * 1000;
        if (new Date(activityEnd).getTime() - new Date(activityStart).getTime() > fiveYearsMs) {
          console.warn(
            `[AVETMISS] NAT00120: Unit "${unit.code}" student "${clientId}" activity spans > 5 years — Rule #3253.`
          );
        }

        let deliveryMode = getDeliveryModeCode(cls.reportingDetails?.avetmissDeliveryMode);
        if (["51", "52", "60"].includes(outcomeCode)) {
          deliveryMode = "NNN";
        } else if (deliveryMode === "NNN" && !["70", "85"].includes(outcomeCode)) {
          console.warn(
            `[AVETMISS] NAT00120: deliveryMode is NNN but outcome="${outcomeCode}" for unit "${unit.code}". ` +
              `Defaulting delivery mode to YNN to keep record valid.`
          );
          deliveryMode = "YNN";
        }

        const qualCode = (qual as any)?.code ?? "";
        const startDateStr = formatDate(activityStart);

        // FIX (CRITICAL — Rule #4693): Skip duplicate records
        const dedupKey = `${rtoId}|${clientId}|${unit.code}|${qualCode}|${startDateStr}`;
        if (seenRecords.has(dedupKey)) {
          console.warn(
            `[AVETMISS] NAT00120: Skipping duplicate record — ` +
              `client="${clientId}" unit="${unit.code}" qual="${qualCode}" start="${startDateStr}"`
          );
          continue;
        }
        seenRecords.add(dedupKey);

        const buf = " ".repeat(158).split(""); // full record including optional fields up to pos 158
        const write = (pos: number, len: number, val: string) => {
          const str = (val ?? "").substring(0, len).padEnd(len, " ");
          for (let i = 0; i < len; i++) buf[pos - 1 + i] = str[i];
        };
        // const writeN = (pos: number, len: number, val: string | number) => {
        //   const str = String(val ?? "")
        //     .substring(0, len)
        //     .padStart(len, "0");
        //   for (let i = 0; i < len; i++) buf[pos - 1 + i] = str[i];
        // };

        // R-06: Student-level fundingSourceNational overrides class default
        const studentFundRaw = (student as any)?.fundingSourceNational;
        const effectiveFundNational = studentFundRaw ? getFundingSourceNationalCode(studentFundRaw) : fundNational;

        // R-05: Commencing program code — "3"=commencing, "4"=continuing, "8"=UoC/SOA only
        // Explicit override takes precedence; blank = auto-derive
        const qualId = (qual as any)?._id?.toString() ?? "";
        const firstDateForStudentQual = studentQualFirstDate.get(`${enrollment.studentInfo.id}:${qualId}`);
        const thisClassStart = new Date(cls.classDetails?.startDate).getTime();
        const overrideCode = ((enrollment as any).commencingProgramOverride ?? "").trim();
        const commencingCode = overrideCode
          ? overrideCode
          : firstDateForStudentQual === thisClassStart
            ? "3" // first time in this qualification
            : "4"; // continuing (enrolled in another class for same qual earlier)

        // ── NAT00120 field layout per ACT AVETMISS Data Standard docx ──────────
        write(1, 10, padA(rtoId, 10)); // Pos   1–10 : Training org identifier
        write(11, 10, padA(locationId, 10)); // Pos  11–20 : Location identifier
        write(21, 10, padA(clientId, 10)); // Pos  21–30 : Client identifier
        write(31, 12, padA(unit.code, 12)); // Pos  31–42 : Subject identifier
        write(43, 10, padA(qualCode, 10)); // Pos  43–52 : Program identifier
        write(53, 8, startDateStr); // Pos  53–60 : Activity start date
        write(61, 8, formatDate(activityEnd)); // Pos  61–68 : Activity end date
        write(69, 3, padA(deliveryMode, 3)); // Pos  69–71 : Delivery mode identifier (3 chars)
        write(72, 2, padA(outcomeCode, 2)); // Pos  72–73 : Outcome identifier — national
        write(74, 2, padA(effectiveFundNational, 2)); // Pos  74–75 : Funding source — national (R-06 student-first)
        write(76, 1, padA(commencingCode, 1)); // Pos  76    : Commencing program identifier (R-05 dynamic)
        // R-19: Training contract + apprenticeship client identifier
        // R-19: if student is apprentice but IDs missing, write @@@@@@@@@@ (10 chars) per spec
        const isApprentice = (student as any)?.isApprentice === true;
        const contractId = (enrollment as any).trainingContractId?.trim() ?? "";
        const apprenticeClientId = (enrollment as any).apprenticeshipClientId?.trim() ?? "";
        write(77, 10, padA(contractId || (isApprentice ? "@@@@@@@@@@" : ""), 10)); // Pos  77–86 : Training contract identifier
        write(87, 10, padA(apprenticeClientId || (isApprentice ? "@@@@@@@@@@" : ""), 10)); // Pos  87–96 : Client identifier — apprenticeships
        write(97, 2, padA(getStudyReasonCode(enrollment.studyReason), 2)); // Pos  97–98 : Study reason
        write(99, 1, padA(vetInSchools, 1)); // Pos  99    : VET in schools flag
        const enrollmentSFI = ((enrollment as any).specificFundingIdentifier ?? "").trim();
        const effectiveSFI = enrollmentSFI || specificFundingIdentifier;
        write(100, 10, padA(effectiveFundNational === "13" || effectiveFundNational === "15" ? effectiveSFI : "", 10)); // Pos 100–109: Specific funding identifier
        write(110, 2, padA("", 2)); // Pos 110–111: School type identifier (blank)
        // Pos 112–114: Outcome identifier — training organisation (optional, blank)
        write(112, 3, padA("", 3));
        // Pos 115–117: Funding source — state training authority (3 chars)
        write(115, 3, padA(fundState, 3));
        // R-04: Principle delivery mode (I/E/W/N) at pos 158
        const pdm = (cls.reportingDetails?.principleDeliveryMode ?? " ").trim();
        write(158, 1, padA(["I", "E", "W", "N"].includes(pdm) ? pdm : " ", 1));
        lines.push(buf.join("").substring(0, 158) + "\n");
      }
    }
  }

  return { content: lines.join(""), studentIds, qualificationIds, unitCodes, locationMap };
};

/**
 * NAT00130 — Program Completed File
 *
 * Field layout confirmed from ACT AVETMISS Data Standard docx (v2.03):
 *   Pos  1–10 : Training organisation identifier  (10, A)
 *   Pos 11–20 : Program identifier                (10, A)
 *   Pos 21–30 : Client identifier                 (10, A)
 *   Pos 31–38 : Date program completed            ( 8, A)  DDMMYYYY
 *   Pos 39    : Issued flag                       ( 1, A)  "Y" = issued, "N" = not issued
 *   Record length for national = 39
 *   Pos 40–47 : Parchment issue date              ( 8, A)  optional
 *   Pos 48–72 : Parchment number                  (25, A)  optional
 *
 * CRITICAL FIX: Issued flag is 1 char "Y"/"N" (alphanumeric), NOT 2-char "10"/"20".
 * CRITICAL FIX: Field positions corrected — parchment date pos 40, number pos 48.
 *   Previous generator had these shifted by one position (pos 39 and 47).
 * FIX (HIGH — Rule #4518): Duplicate check on (qualCode + clientId).
 * FIX (MEDIUM — Rule #3217): Completions > 10 years before collection start skipped.
 */
const generateNAT00130 = async (
  organizationId: string,
  rtoId: string,
  startDate: Date,
  endDate: Date
): Promise<string> => {
  const classes = await ClassModel.find({ organizationId }).populate("qualificationId");

  const lines: string[] = [];
  const seenCompletions = new Set<string>(); // dedup: (qualCode|clientId)

  const tenYearsBeforeStart = new Date(startDate);
  tenYearsBeforeStart.setFullYear(tenYearsBeforeStart.getFullYear() - 10);

  for (const cls of classes) {
    if (cls.reportingDetails?.doNotReport) continue;
    const qual = cls.qualificationId as any;

    for (const enrollment of cls.enrollments ?? []) {
      if (!enrollment.completionDate) continue;
      const completionDate = new Date(enrollment.completionDate);
      if (isNaN(completionDate.getTime())) {
        console.warn(
          `[AVETMISS] NAT00130: Student "${enrollment.studentInfo.id}" has invalid completionDate — skipping.`
        );
        continue;
      }

      if (completionDate > endDate) continue;

      if (completionDate < tenYearsBeforeStart) {
        console.warn(
          `[AVETMISS] NAT00130: Skipping completion for student "${enrollment.studentInfo.id}" ` +
            `qual "${qual?.code}" — more than 10 years before collection year (Rule #3217).`
        );
        continue;
      }

      if (completionDate < startDate) continue;

      const student = await StudentModel.findById(enrollment.studentInfo.id).select("avetmissId");
      const clientId = (student?.avetmissId ?? "").trim();
      if (!clientId) {
        console.warn(
          `[AVETMISS] NAT00130: Student "${enrollment.studentInfo.id}" has no avetmissId — skipping completion (Error #4007).`
        );
        continue;
      }

      const qualCode = qual?.code ?? "";

      const dedupKey = `${qualCode}|${clientId}`;
      if (seenCompletions.has(dedupKey)) {
        console.warn(`[AVETMISS] NAT00130: Skipping duplicate — qual="${qualCode}" client="${clientId}"`);
        continue;
      }
      seenCompletions.add(dedupKey);

      const issuedFlag = (enrollment.issuedFlag ?? "N") === "Y" ? "Y" : "N"; // 1 char "Y"/"N" per spec
      const issuedDate = issuedFlag === "Y" ? formatDate(enrollment.certificateIssuedDate) : "        ";
      const parchmentNumber = enrollment.certificateShortId ?? "";

      // Buffer covers national (39) + optional parchment fields (pos 40–72)
      const buf = " ".repeat(72).split("");
      const write = (pos: number, len: number, val: string) => {
        const str = (val ?? "").substring(0, len).padEnd(len, " ");
        for (let i = 0; i < len; i++) buf[pos - 1 + i] = str[i];
      };

      write(1, 10, padA(rtoId, 10)); // Pos  1–10: Training org identifier
      write(11, 10, padA(qualCode, 10)); // Pos 11–20: Program identifier
      write(21, 10, padA(clientId, 10)); // Pos 21–30: Client identifier
      write(31, 8, formatDate(enrollment.completionDate)); // Pos 31–38: Date program completed
      write(39, 1, issuedFlag); // Pos 39   : Issued flag ("Y"/"N")
      write(40, 8, issuedDate); // Pos 40–47: Parchment issue date
      write(48, 25, padA(parchmentNumber, 25)); // Pos 48–72: Parchment number

      lines.push(buf.join("") + "\n");
    }
  }
  return lines.join("");
};

// ─── MAIN REPORT GENERATOR ─────────────────────────────────────────────────────

const generateAvetmissReport = async (
  organizationId: string,
  userId: string,
  data: GenerateAvetmissReportT
): Promise<{ reportId: string; reportKey: string; summary: object }> => {
  const org = await OrganizationModel.findById(organizationId);
  if (!org) throw new AppError(httpStatus.NOT_FOUND, "NOT_FOUND", "Organization not found");

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  endDate.setHours(23, 59, 59, 999);

  const rtoId = org.rtoId;

  const reportId = await generateSequentialId({
    key: `avetmiss-report:${organizationId}`,
    prefix: "REP",
    middleIndicator: "AVETMISS-",
    pad: 7
  });

  const from = startDate.toISOString().slice(0, 10);
  const to = endDate.toISOString().slice(0, 10);

  const fileName = `avetmiss_${from}_to_${to}_${reportId}.zip`;
  const title = `avetmiss_${from}_to_${to}`;

  const nat120Result = await generateNAT00120(organizationId, rtoId, startDate, endDate);

  const nat10 = await generateNAT00010(organizationId);

  // Merge locationMap (from NAT00120 classes) with all active DeliveryLocations for this org
  const activeDelivLocs = await DeliveryLocationModel.find({ organizationId, isDeleted: { $ne: true } }).lean();
  for (const dl of activeDelivLocs) {
    if (!nat120Result.locationMap.has(dl.locationIdentifier)) {
      nat120Result.locationMap.set(dl.locationIdentifier, {
        locationId: dl.locationIdentifier,
        name: dl.name,
        city: dl.city,
        postcode: dl.postcode,
        state: dl.state
      });
    }
  }
  const nat20 = await generateNAT00020(rtoId, Array.from(nat120Result.locationMap.values()));
  const nat30 = await generateNAT00030(Array.from(nat120Result.qualificationIds));
  const nat60 = await generateNAT00060(Array.from(nat120Result.unitCodes), organizationId);
  const nat80 = await generateNAT00080(Array.from(nat120Result.studentIds), endDate);
  const nat85 = await generateNAT00085(Array.from(nat120Result.studentIds));
  const nat90 = await generateNAT00090(Array.from(nat120Result.studentIds));
  const nat100 = await generateNAT00100(Array.from(nat120Result.studentIds));
  const nat130 = await generateNAT00130(organizationId, rtoId, startDate, endDate);

  const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    const passThrough = new PassThrough();
    passThrough.on("data", (chunk) => chunks.push(chunk));
    passThrough.on("end", () => resolve(Buffer.concat(chunks)));
    passThrough.on("error", reject);
    archive.on("error", reject);
    archive.pipe(passThrough);
    archive.append(nat10, { name: "NAT00010.txt" });
    archive.append(nat20, { name: "NAT00020.txt" });
    archive.append(nat30, { name: "NAT00030A.txt" });
    archive.append(nat60, { name: "NAT00060.txt" });
    archive.append(nat80, { name: "NAT00080.txt" });
    archive.append(nat85, { name: "NAT00085.txt" });
    archive.append(nat90, { name: "NAT00090.txt" });
    // NAT00100 may be empty (no students with prior achievements) — append empty string
    // is fine; archiver will create a 0-byte file in the zip which NCVER accepts.
    // We use a Buffer to guarantee the entry is created even when content is "".
    archive.append(Buffer.from(nat100, "utf8"), { name: "NAT00100.txt" });
    archive.append(nat120Result.content, { name: "NAT00120.txt" });
    archive.append(nat130, { name: "NAT00130.txt" });
    archive.finalize();
  });

  const uploadResult = await CloudflareService.uploadBufferToR2(zipBuffer, fileName, "avetmiss-reports", false, true);
  if (!uploadResult.success) {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Failed to upload report");
  }

  const reportKey = uploadResult.key!;

  let report;
  try {
    report = await AvetmissReportModel.create({
      title,
      organizationId,
      reportId,
      reportType: "AVETMISS",
      startDate,
      endDate,
      periodLabel: data.periodLabel ?? `${from} to ${to}`,
      reportKey,
      generatedBy: userId,
      totalStudents: nat120Result.studentIds.size,
      totalEnrolments: (nat120Result.content.match(/\n/g) ?? []).length,
      totalCompletions: (nat130.match(/\n/g) ?? []).length,
      status: "completed"
    });
  } catch (err: any) {
    if (err?.code === 11000 && err?.keyPattern?.reportId) {
      throw new AppError(httpStatus.CONFLICT, CONFLICT_ERROR.code, "Report ID conflict, please try again");
    }
    throw err;
  }

  return {
    reportId: report._id.toString(),
    reportKey,
    summary: {
      totalStudents: nat120Result.studentIds.size,
      totalEnrolments: (nat120Result.content.match(/\n/g) ?? []).length,
      totalCompletions: (nat130.match(/\n/g) ?? []).length
    }
  };
};

const getAllReports = async (query: Record<string, string>, organizationId: string) => {
  const queryBuilder = new QueryBuilder(AvetmissReportModel.find({ organizationId }), query);
  const reports = await queryBuilder.filter().sort().select().pagination().build();
  const meta = await queryBuilder.getMeta();
  return { reports, ...meta };
};

const downloadReport = async (id: string) => {
  const report = await AvetmissReportModel.findById(id);
  if (!report) throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Report not found");
  return report.reportKey;
};

const bulkDownloadReports = async (organizationId: string, startDate: string, endDate: string, res: Response) => {
  const reports = await AvetmissReportModel.find({
    organizationId,
    createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
  });

  if (!reports.length) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "No reports found in this date range");
  }

  const from = new Date(startDate).toISOString().slice(0, 10);
  const to = new Date(endDate).toISOString().slice(0, 10);
  const zipFileName = `avetmiss_${from}_to_${to}.zip`;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipFileName}"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(res);

  for (const report of reports) {
    const fileUrl = `${process.env.R2_PUBLIC_BASE_URL}/${report.reportKey}`;
    const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data);
    const stream = Readable.from(buffer);
    const originalFileName = report.reportKey.split("/").pop() || `${report._id}.zip`;
    archive.append(stream, { name: originalFileName });
  }

  await archive.finalize();
};

const validateAvetmissZip = (buffer: Buffer, fileName: string): void => {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", `File "${fileName}" is not a valid ZIP archive`);
  }

  const entries = zip.getEntries().filter((e) => !e.isDirectory);

  if (entries.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", `ZIP file "${fileName}" is empty`);
  }

  for (const entry of entries) {
    const name = (entry.entryName.split("/").pop() ?? entry.entryName).toUpperCase();
    if (!name.endsWith(".TXT")) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "BAD_REQUEST",
        `ZIP "${fileName}" contains a non-.txt file: "${entry.entryName}". Only .txt NAT files are allowed.`
      );
    }
  }
};

const importAvetmissReports = async (
  organizationId: string,
  generatedBy: string,
  items: { buffer: Buffer; originalName: string; startDate: Date; endDate: Date }[]
): Promise<{ imported: number; results: { fileName: string; reportId: string }[] }> => {
  if (!items || items.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "At least one ZIP file is required");
  }
  if (items.length > 5) {
    throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", "Maximum 5 ZIP files allowed per import");
  }

  const org = await OrganizationModel.findById(organizationId);
  if (!org) throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Organization not found");

  for (const item of items) {
    if (!item.originalName.toLowerCase().endsWith(".zip")) {
      throw new AppError(httpStatus.BAD_REQUEST, "BAD_REQUEST", `File "${item.originalName}" is not a .zip file`);
    }
    validateAvetmissZip(item.buffer, item.originalName);
  }

  const results: { fileName: string; reportId: string }[] = [];

  for (const item of items) {
    const reportId = await generateSequentialId({
      key: `avetmiss-report:${organizationId}`,
      prefix: "REP",
      middleIndicator: "AVETMISS-",
      pad: 7
    });

    const safeOriginalName = item.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${reportId}_${safeOriginalName}`;

    const uploadResult = await CloudflareService.uploadBufferToR2(
      item.buffer,
      fileName,
      "avetmiss-reports",
      false,
      true
    );

    if (!uploadResult.success) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "UPLOAD_FAILED",
        `Failed to upload file "${item.originalName}" to storage`
      );
    }

    const from = item.startDate.toISOString().slice(0, 10);
    const to = item.endDate.toISOString().slice(0, 10);

    await AvetmissReportModel.create({
      title: `avetmiss_${item.startDate.toISOString().slice(0, 10)}_${item.endDate.toISOString().slice(0, 10)}`,
      organizationId,
      reportId,
      reportType: "AVETMISS",
      startDate: item.startDate,
      endDate: item.endDate,
      periodLabel: `${from} to ${to}`,
      reportKey: uploadResult.key!,
      generatedBy,
      status: "completed",
      isImported: true
    });

    results.push({ fileName: item.originalName, reportId });

    // Parse NAT files from the ZIP and auto-create records (locations, quals, units, students, classes)
    try {
      const natSummary = await importFromNatZip(organizationId, item.buffer);
      results[results.length - 1] = { ...results[results.length - 1], natImport: natSummary } as any;
    } catch (natErr) {
      // NAT parsing failure must not roll back the archive — log and continue
      console.error(`[NAT Import] Failed for "${item.originalName}":`, natErr);
    }
  }

  return { imported: results.length, results };
};

const deleteReport = async (id: string) => {
  const report = await AvetmissReportModel.findById(id);
  if (!report) throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, "Report not found");
  await CloudflareService.deleteFileFromR2(report.reportKey);
  await AvetmissReportModel.findByIdAndDelete(id);
};

export const AvetmissServices = {
  generateAvetmissReport,
  getAllReports,
  downloadReport,
  bulkDownloadReports,
  importAvetmissReports,
  deleteReport
};

/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * NAT Import Service — SA-06
 *
 * Parses an AVETMISS ZIP (containing NAT .txt files) and upserts records into:
 *   NAT00020  → DeliveryLocation + legacy Location
 *   NAT00030A → Qualification
 *   NAT00060  → Unit
 *   NAT00080 + NAT00085 → Student
 *   NAT00090  → Student disability types (update)
 *   NAT00100  → Student prior ed achievements (update)
 *   NAT00120  → Synthetic Class + Enrollments
 *   NAT00130  → Enrollment completions (update)
 *
 * All imported records are tagged importedFromNat: true where applicable.
 * Students with missing birthCity are marked with birthCity: "Not Stated"
 * and can be filtered via importedFromNat + birthCity === "Not Stated".
 */

import AdmZip from "adm-zip";
import mongoose from "mongoose";
import { DeliveryLocationModel } from "../model/delivery-location.model";
import { LocationModel } from "../model/location.model";
import { QualificationModel } from "../model/qualification.model";
import { UnitModel } from "../model/unit.model";
import { StudentModel } from "../model/student.model";
import { ClassModel } from "../model/class.model";
import { generateStudentId } from "../utils/sequentialIdGenerator";
import { logger } from "../utils";
import { UNIT_COMPETENCY_MAP } from "../constants";

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** 1-based fixed-width field extractor */
const read = (line: string, pos: number, len: number): string => line.substring(pos - 1, pos - 1 + len).trim();

/** Reverse map: AVETMISS 2-digit number code → ProSMS internal status code */
const OUTCOME_CODE_REVERSE: Record<string, string> = Object.fromEntries(
  Object.values(UNIT_COMPETENCY_MAP).map((v) => [String(v.numberCode).padStart(2, "0"), v.code])
);

const STATE_CODE_REVERSE: Record<string, string> = {
  "01": "NSW",
  "02": "VIC",
  "03": "QLD",
  "04": "SA",
  "05": "WA",
  "06": "TAS",
  "07": "NT",
  "08": "ACT",
  "09": "OTH",
  "99": "OVS"
};

const INDIGENOUS_MAP: Record<string, string> = {
  "1": "aboriginal",
  "2": "torresStrait",
  "3": "both",
  "4": "neither",
  "@": "notStated"
};

const GENDER_MAP: Record<string, string> = {
  M: "male",
  F: "female",
  X: "x",
  "1": "male",
  "2": "female",
  "3": "x",
  "@": "notStated"
};

const boolFlag = (v: string): boolean | null => (v === "Y" || v === "1" ? true : v === "N" || v === "2" ? false : null);

/** DDMMYYYY → "YYYY-MM-DD", empty string if invalid */
const parseDob = (dob: string): string => {
  if (!dob || !/^\d{8}$/.test(dob)) return "";
  return `${dob.substring(4, 8)}-${dob.substring(2, 4)}-${dob.substring(0, 2)}`;
};

/** DDMMYYYY → JS Date, null if invalid */
const parseNatDate = (s: string): Date | null => {
  if (!s || s.replace(/ /g, "").replace(/@/g, "").length === 0) return null;
  if (!/^\d{8}$/.test(s)) return null;
  const d = new Date(`${s.substring(4, 8)}-${s.substring(2, 4)}-${s.substring(0, 2)}`);
  return isNaN(d.getTime()) ? null : d;
};

// ─── User-facing import feedback (what / why / what-to-do) ────────────────────

export type ImportIssueSeverity = "error" | "warning" | "skip";
export type ImportIssueScope =
  | "file"
  | "student"
  | "qualification"
  | "unit"
  | "location"
  | "class"
  | "enrolment"
  | "completion";

export interface ImportIssue {
  severity: ImportIssueSeverity;
  scope: ImportIssueScope;
  ref?: string; // identifier the issue is about (avetmissId, unit code, qual code, …)
  message: string; // plain-language "what happened + why"
  action: string; // plain-language "what to do"
}

/** Turn a raw/technical error into a short plain-language sentence for end users */
const friendlyImportError = (raw: string): string => {
  if (!raw) return "Unknown error.";
  if (/E11000|duplicate key/i.test(raw)) return "A record with the same unique value already exists.";
  if (/givenName.*required|required.*givenName/i.test(raw)) return "The given name is missing.";
  if (/surname.*required|required.*surname/i.test(raw)) return "The surname is missing.";
  if (/email/i.test(raw) && /required|valid/i.test(raw)) return "The email is missing or invalid.";
  if (/validation failed/i.test(raw)) return "Some required information was missing or invalid.";
  if (/cast to .* failed/i.test(raw)) return "A field had an unexpected value.";
  return raw;
};

// ─── NAT00020 — Delivery Locations ────────────────────────────────────────────

interface Nat20Record {
  locationId: string;
  name: string;
  postcode: string;
  stateCode: string;
  city: string;
}

const parseNAT00020 = (content: string): Nat20Record[] =>
  content
    .split(/\r?\n/)
    .filter((l) => l.length >= 20)
    .map((l) => ({
      locationId: read(l, 11, 10),
      name: read(l, 21, 100),
      postcode: read(l, 121, 4),
      stateCode: read(l, 125, 2),
      city: read(l, 127, 50)
    }))
    .filter((r) => r.locationId);

const upsertDeliveryLocations = async (
  organizationId: string,
  records: Nat20Record[]
): Promise<{ created: number; updated: number }> => {
  let created = 0;
  let updated = 0;
  for (const r of records) {
    const state = STATE_CODE_REVERSE[r.stateCode] ?? r.stateCode;
    const filter = { organizationId, locationIdentifier: r.locationId };
    const data = {
      name: r.name || r.city || r.locationId,
      city: r.city || "Not Stated",
      state,
      postcode: r.postcode || "0000"
    };

    const existing = await DeliveryLocationModel.findOne(filter);
    if (existing) {
      await DeliveryLocationModel.updateOne(filter, { $set: data });
      updated += 1;
    } else {
      await DeliveryLocationModel.create({ ...filter, ...data });
      created += 1;
    }

    // Keep legacy Location in sync for classDetails.location FK
    const locFilter = { organizationId, locationId: r.locationId };
    const locData = {
      addressLine: r.name || r.city || r.locationId,
      city: r.city,
      state,
      postcode: r.postcode,
      country: "Australia"
    };
    await LocationModel.findOneAndUpdate(locFilter, { $set: locData }, { upsert: true, new: true });
  }
  return { created, updated };
};

// ─── NAT00030A — Qualifications ───────────────────────────────────────────────

interface Nat30Record {
  code: string;
  title: string;
  nominalHours: number;
  oscaIdentifier: string;
}

const parseNAT00030A = (content: string): Nat30Record[] =>
  content
    .split(/\r?\n/)
    .filter((l) => l.length >= 114)
    .map((l) => ({
      code: read(l, 1, 10),
      title: read(l, 11, 100),
      nominalHours: parseInt(read(l, 111, 4), 10) || 0,
      oscaIdentifier: l.length >= 130 ? read(l, 124, 6) : ""
    }))
    .filter((r) => r.code);

const upsertQualifications = async (
  organizationId: string,
  records: Nat30Record[]
): Promise<{ created: number; updated: number }> => {
  let created = 0;
  let updated = 0;
  for (const r of records) {
    const filter = { organizationId, code: r.code };
    const data = {
      title: r.title,
      nominalHours: r.nominalHours,
      oscaIdentifier: r.oscaIdentifier || undefined,
      status: "Current"
    };
    const existing = await QualificationModel.findOne(filter);
    if (existing) {
      await QualificationModel.updateOne(filter, {
        $set: {
          title: r.title,
          nominalHours: r.nominalHours,
          ...(r.oscaIdentifier ? { oscaIdentifier: r.oscaIdentifier } : {})
        }
      });
      updated += 1;
    } else {
      await QualificationModel.create({ ...filter, ...data });
      created += 1;
    }
  }
  return { created, updated };
};

// ─── NAT00060 — Units ─────────────────────────────────────────────────────────

interface Nat60Record {
  code: string;
  title: string;
  fieldOfEducationId: string;
  vetFlag: string;
  hour: number;
}

const parseNAT00060 = (content: string): Nat60Record[] =>
  content
    .split(/\r?\n/)
    .filter((l) => l.length >= 112)
    .map((l) => ({
      code: read(l, 1, 12),
      title: read(l, 13, 100),
      fieldOfEducationId: read(l, 113, 6),
      vetFlag: l.length >= 119 ? read(l, 119, 1) || "Y" : "Y",
      hour: l.length >= 123 ? parseInt(read(l, 120, 4), 10) || 0 : 0
    }))
    .filter((r) => r.code);

const upsertUnits = async (
  organizationId: string,
  records: Nat60Record[]
): Promise<{ created: number; updated: number }> => {
  let created = 0;
  let updated = 0;
  for (const r of records) {
    const filter = { organizationId, code: r.code };
    const existing = await UnitModel.findOne(filter);
    if (existing) {
      await UnitModel.updateOne(filter, {
        $set: {
          title: r.title,
          hour: r.hour,
          fieldOfEducationId: r.fieldOfEducationId || undefined,
          vetFlag: r.vetFlag
        }
      });
      updated += 1;
    } else {
      await UnitModel.create({
        ...filter,
        title: r.title,
        hour: r.hour,
        fieldOfEducationId: r.fieldOfEducationId || undefined,
        vetFlag: r.vetFlag,
        hasPreRequisites: false,
        isEssential: false,
        isEssentialLabel: "Elective" as const,
        usageRecommendation: "Current",
        usageRecommendationLabel: "Current",
        status: "Current",
        unitType: "Elective" as const
      });
      created += 1;
    }
  }
  return { created, updated };
};

// ─── NAT00080 + NAT00085 — Students ───────────────────────────────────────────

interface Nat80Record {
  avetmissId: string;
  compoundName: string;
  educationLevel: string;
  gender: string;
  dob: string;
  postcode: string;
  indigenous: string;
  language: string;
  labourForce: string;
  birthCountry: string;
  disabilityFlag: string;
  priorEdFlag: string;
  atSchoolFlag: string;
  suburb: string;
  usi: string;
  stateCode: string;
  building: string;
  unit: string;
  streetNumber: string;
  streetName: string;
  surveyStatus: string;
}

interface Nat85Record {
  avetmissId: string;
  title: string;
  givenName: string;
  surname: string;
  streetNumber: string;
  streetName: string;
  poBox: string;
  suburb: string;
  postcode: string;
  stateCode: string;
  email: string;
}

const parseNAT00080 = (content: string): Nat80Record[] =>
  content
    .split(/\r?\n/)
    .filter((l) => l.length >= 10)
    .map(
      (l): Nat80Record => ({
        avetmissId: read(l, 1, 10),
        compoundName: read(l, 11, 60),
        educationLevel: read(l, 71, 2),
        gender: read(l, 73, 1),
        dob: read(l, 74, 8),
        postcode: read(l, 82, 4),
        indigenous: read(l, 86, 1),
        language: read(l, 87, 4),
        labourForce: read(l, 91, 2),
        birthCountry: read(l, 93, 4),
        disabilityFlag: read(l, 97, 1),
        priorEdFlag: read(l, 98, 1),
        atSchoolFlag: read(l, 99, 1),
        suburb: read(l, 100, 50),
        usi: read(l, 150, 10),
        stateCode: read(l, 160, 2),
        building: read(l, 162, 50),
        unit: read(l, 212, 30),
        streetNumber: read(l, 242, 15),
        streetName: read(l, 257, 70),
        surveyStatus: read(l, 327, 1)
      })
    )
    .filter((r) => r.avetmissId.replace(/@/g, "").trim().length > 0);

const parseNAT00085 = (content: string): Map<string, Nat85Record> => {
  const map = new Map<string, Nat85Record>();
  content
    .split(/\r?\n/)
    .filter((l) => l.length >= 10)
    .forEach((l) => {
      const rec: Nat85Record = {
        avetmissId: read(l, 1, 10),
        title: read(l, 11, 4),
        givenName: read(l, 15, 40),
        surname: read(l, 55, 40),
        streetNumber: read(l, 175, 15),
        streetName: read(l, 190, 70),
        poBox: read(l, 260, 22),
        suburb: read(l, 282, 50),
        postcode: read(l, 332, 4),
        stateCode: read(l, 336, 2),
        email: read(l, 398, 80)
      };
      if (rec.avetmissId) map.set(rec.avetmissId, rec);
    });
  return map;
};

const resolveTitle = (gender: string, nat85Title?: string): string => {
  if (nat85Title?.trim()) return nat85Title.trim().replace(/\.+$/, "");
  const g = gender.toUpperCase();
  if (g === "M" || g === "1") return "Mr";
  if (g === "F" || g === "2") return "Ms";
  return "Mx";
};

export interface StudentImportResult {
  created: number;
  skipped: number;
  failed: number;
  errors: { avetmissId: string; reason: string }[];
}

const upsertStudents = async (
  organizationId: string,
  nat80Records: Nat80Record[],
  nat85Map: Map<string, Nat85Record>,
  reportId?: string
): Promise<StudentImportResult> => {
  const result: StudentImportResult = { created: 0, skipped: 0, failed: 0, errors: [] };

  for (const r of nat80Records) {
    try {
      const existing = await StudentModel.findOne({ organizationId, avetmissId: r.avetmissId }).select("_id isDeleted");
      if (existing) {
        // Re-import of a previously soft-deleted student → restore it so it reappears (issue #2)
        if ((existing as any).isDeleted) {
          await StudentModel.updateOne(
            { _id: existing._id },
            { $set: { isDeleted: false }, $unset: { deletedAt: "" } }
          );
          result.created += 1;
        } else {
          result.skipped += 1;
        }
        continue;
      }

      const n85 = nat85Map.get(r.avetmissId);
      let surname = "";
      let givenName = "";
      let isSingleName = false;
      if (n85?.surname) {
        surname = n85.surname;
        givenName = n85.givenName || "";
      } else {
        const ci = r.compoundName.indexOf(",");
        if (ci >= 0) {
          surname = r.compoundName.substring(0, ci).trim();
          givenName = r.compoundName.substring(ci + 1).trim();
        } else {
          surname = r.compoundName.trim();
          isSingleName = true;
        }
      }

      const suburb = (n85?.suburb || r.suburb || "").trim() || "Not Stated";
      const postcode = (n85?.postcode || r.postcode || "").trim() || "0000";
      const stateRaw = (n85?.stateCode || r.stateCode || "").trim();
      const state = (STATE_CODE_REVERSE[stateRaw] ?? stateRaw) || "Not Stated";
      const email = n85?.email?.trim() || `imported-${r.avetmissId}@prosms.local`;

      const studentId = await generateStudentId(organizationId);

      await StudentModel.create({
        organizationId,
        studentId,
        avetmissId: r.avetmissId,
        importedFromNat: true,
        natImportReportId: reportId,
        personalInfo: {
          title: resolveTitle(r.gender, n85?.title),
          // Mononym: leave givenName blank; the single name is stored in surname (AVETMISS family name)
          givenName: isSingleName ? "" : givenName || "Imported",
          surname: surname || "Imported",
          isSingleName,
          gender: GENDER_MAP[r.gender.toUpperCase()] ?? "notStated",
          dateOfBirth: parseDob(r.dob) || "1900-01-01"
        },
        contactDetails: {
          email,
          personalPhone: { countryCode: "+61", number: "0000000000" }
        },
        address: {
          arePostalStreetAddressSame: true,
          primaryPostalAddress: {
            building: r.building.trim() || undefined,
            unit: r.unit.trim() || undefined,
            streetNumber: (n85?.streetNumber || r.streetNumber).trim() || undefined,
            streetName: (n85?.streetName || r.streetName).trim() || undefined,
            POBox: n85?.poBox?.trim() || undefined,
            city: suburb,
            state,
            postCode: postcode,
            country: "Australia"
          },
          primaryStreetAddress: { city: suburb, state, postCode: postcode, country: "Australia" }
        },
        vetDetails: {
          birthCountry: r.birthCountry.replace(/@/g, "").trim() || "1101",
          birthCity: "Not Stated",
          abOriginalOrigin: INDIGENOUS_MAP[r.indigenous] ?? "notStated",
          language: r.language.replace(/@/g, "").trim() || "1201",
          employmentStatus: r.labourForce.replace(/@/g, "").trim() || undefined,
          educationLevel: ["02", "08", "09", "10", "11", "12", "@@"].includes(r.educationLevel)
            ? r.educationLevel
            : "@@",
          disabilities: boolFlag(r.disabilityFlag),
          priorEducation: boolFlag(r.priorEdFlag),
          atSchool: boolFlag(r.atSchoolFlag),
          surveyContactStatus: r.surveyStatus.replace(/@/g, "").trim() || undefined
        },
        participantsIdentifiers: {
          USI: r.usi.replace(/@/g, "").trim() || undefined,
          isUSIVerified: false
        },
        emergencyContacts: [],
        parents: []
      });

      result.created += 1;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logger.warn(`[NAT Import] Student ${r.avetmissId} failed: ${msg}`);
      result.failed += 1;
      result.errors.push({ avetmissId: r.avetmissId, reason: msg });
    }
  }
  return result;
};

// ─── NAT00090 — Disability types ──────────────────────────────────────────────

interface Nat90Record {
  avetmissId: string;
  disabilityType: string;
}

const parseNAT00090 = (content: string): Nat90Record[] =>
  content
    .split(/\r?\n/)
    .filter((l) => l.length >= 12)
    .map((l) => ({ avetmissId: read(l, 1, 10), disabilityType: read(l, 11, 2) }))
    .filter((r) => r.avetmissId);

const applyDisabilityTypes = async (organizationId: string, records: Nat90Record[]): Promise<number> => {
  const byStudent = new Map<string, string[]>();
  for (const r of records) {
    if (!byStudent.has(r.avetmissId)) byStudent.set(r.avetmissId, []);
    byStudent.get(r.avetmissId)!.push(r.disabilityType);
  }
  let updated = 0;
  for (const [avetmissId, types] of byStudent) {
    const res = await StudentModel.updateOne(
      { organizationId, avetmissId },
      { $set: { "vetDetails.disabilityTypes": types, "vetDetails.disabilities": true } }
    );
    if (res.modifiedCount) updated += 1;
  }
  return updated;
};

// ─── NAT00100 — Prior educational achievements ────────────────────────────────

interface Nat100Record {
  avetmissId: string;
  code: string;
}

const parseNAT00100 = (content: string): Nat100Record[] =>
  content
    .split(/\r?\n/)
    .filter((l) => l.length >= 13)
    .map((l) => ({ avetmissId: read(l, 1, 10), code: read(l, 11, 3) }))
    .filter((r) => r.avetmissId && r.code);

const applyPriorEdAchievements = async (organizationId: string, records: Nat100Record[]): Promise<number> => {
  const byStudent = new Map<string, string[]>();
  for (const r of records) {
    if (!byStudent.has(r.avetmissId)) byStudent.set(r.avetmissId, []);
    byStudent.get(r.avetmissId)!.push(r.code);
  }
  let updated = 0;
  for (const [avetmissId, codes] of byStudent) {
    const achievements = codes.map((c) => ({ code: c, completedYear: "" }));
    const res = await StudentModel.updateOne(
      { organizationId, avetmissId },
      { $set: { "vetDetails.priorEducationalAchievements": achievements, "vetDetails.priorEducation": true } }
    );
    if (res.modifiedCount) updated += 1;
  }
  return updated;
};

// ─── NAT00120 — Synthetic Classes + Enrollments ───────────────────────────────

interface Nat120Record {
  locationId: string;
  clientId: string;
  unitCode: string;
  qualCode: string;
  activityStart: string; // DDMMYYYY
  activityEnd: string;
  deliveryMode: string;
  outcomeCode: string;
  fundNational: string;
  fundState: string;
}

const parseNAT00120 = (content: string): Nat120Record[] =>
  content
    .split(/\r?\n/)
    .filter((l) => l.length >= 75)
    .map(
      (l): Nat120Record => ({
        locationId: read(l, 11, 10),
        clientId: read(l, 21, 10),
        unitCode: read(l, 31, 12),
        qualCode: read(l, 43, 10),
        activityStart: read(l, 53, 8),
        activityEnd: read(l, 61, 8),
        deliveryMode: read(l, 69, 3),
        outcomeCode: read(l, 72, 2),
        fundNational: read(l, 74, 2),
        fundState: l.length >= 117 ? read(l, 115, 3) : " "
      })
    )
    .filter((r) => r.clientId && r.unitCode && r.qualCode);

interface SyntheticClassKey {
  qualCode: string;
  locationId: string;
}
interface SyntheticClassData {
  key: SyntheticClassKey;
  startDate: Date;
  endDate: Date;
  deliveryMode: string;
  fundNational: string;
  fundState: string;
  // clientId → unit records
  enrollments: Map<string, Nat120Record[]>;
}

const buildSyntheticClasses = (records: Nat120Record[]): SyntheticClassData[] => {
  const map = new Map<string, SyntheticClassData>();

  for (const r of records) {
    const mapKey = `${r.qualCode}||${r.locationId}`;
    const start = parseNatDate(r.activityStart);
    const end = parseNatDate(r.activityEnd);
    if (!start || !end) continue;

    if (!map.has(mapKey)) {
      map.set(mapKey, {
        key: { qualCode: r.qualCode, locationId: r.locationId },
        startDate: start,
        endDate: end,
        deliveryMode: r.deliveryMode,
        fundNational: r.fundNational,
        fundState: r.fundState,
        enrollments: new Map()
      });
    }
    const cls = map.get(mapKey)!;
    if (start < cls.startDate) cls.startDate = start;
    if (end > cls.endDate) cls.endDate = end;

    if (!cls.enrollments.has(r.clientId)) cls.enrollments.set(r.clientId, []);
    cls.enrollments.get(r.clientId)!.push(r);
  }

  return Array.from(map.values());
};

interface SyntheticClassResult {
  created: number;
  updated: number;
  enrollmentsCreated: number;
  enrollmentsUpdated: number;
  enrollmentsSkipped: number;
  errors: { class: string; error: string }[];
  issues: ImportIssue[];
}

const createSyntheticClasses = async (
  organizationId: string,
  syntheticClasses: SyntheticClassData[],
  reportId?: string
): Promise<SyntheticClassResult> => {
  let created = 0;
  let updated = 0;
  let enrollmentsCreated = 0;
  let enrollmentsUpdated = 0;
  let enrollmentsSkipped = 0;
  // Per-class failures are isolated here — one bad class never aborts the others (fail-loud, P4)
  const errors: { class: string; error: string }[] = [];

  // Plain-language feedback (what / why / what-to-do), de-duplicated so one missing unit = one issue
  const issues: ImportIssue[] = [];
  const seenIssue = new Set<string>();
  const addIssue = (issue: ImportIssue) => {
    const k = `${issue.severity}|${issue.scope}|${issue.ref ?? ""}|${issue.message}`;
    if (seenIssue.has(k)) return;
    seenIssue.add(k);
    issues.push(issue);
  };

  // AVETMISS natural key for one enrolled unit line within a class:
  // unit code + activity start date (a re-attempt on a new date is a distinct line).
  const unitLineKey = (u: any): string => `${u.code}||${u.unitStartDate ? new Date(u.unitStartDate).getTime() : "na"}`;

  for (const cls of syntheticClasses) {
    const { qualCode, locationId } = cls.key;
    // Deterministic identity → lets re-import find & merge instead of duplicating (P0 idempotency)
    const natImportKey = `${qualCode}||${locationId}`;

    try {
      // Look up references
      const qualification = await QualificationModel.findOne({ organizationId, code: qualCode });
      if (!qualification) {
        logger.warn(`[NAT Import] NAT00120: qualification "${qualCode}" not found — skipping class`);
        addIssue({
          severity: "skip",
          scope: "qualification",
          ref: qualCode,
          message: `Skipped the class for qualification "${qualCode}" — this qualification is not in the import.`,
          action: `Add qualification "${qualCode}" to NAT00030 (or NAT00030A) and re-import the same file.`
        });
        continue;
      }

      const delivLoc = await DeliveryLocationModel.findOne({ organizationId, locationIdentifier: locationId });
      const legacyLoc = await LocationModel.findOne({ organizationId, locationId });
      if (!legacyLoc) {
        logger.warn(`[NAT Import] NAT00120: location "${locationId}" not in Location collection — skipping class`);
        addIssue({
          severity: "skip",
          scope: "location",
          ref: locationId,
          message: `Skipped a class at delivery location "${locationId}" — this location is not in the import.`,
          action: `Add location "${locationId}" to NAT00020 and re-import the same file.`
        });
        continue;
      }

      // ── Build the freshly-parsed enrolment lines from this file ──
      // Distinct units across this file's rows → drives the class "Units" tab (unitsInfo)
      const classUnitsMap = new Map<string, any>();
      const built: { studentId: string; studentInfo: any; unitsOfCompetency: any[] }[] = [];

      for (const [clientId, unitRecords] of cls.enrollments) {
        const student = await StudentModel.findOne({ organizationId, avetmissId: clientId }).select(
          "_id studentId personalInfo contactDetails participantsIdentifiers"
        );
        if (!student) {
          logger.warn(`[NAT Import] NAT00120: student "${clientId}" not found — skipping enrollment`);
          enrollmentsSkipped += 1;
          addIssue({
            severity: "skip",
            scope: "enrolment",
            ref: clientId,
            message: `Skipped an enrolment for student "${clientId}" — this student is not in the client file.`,
            action: `Add student "${clientId}" to NAT00080 and re-import the same file.`
          });
          continue;
        }

        const unitsOfCompetency: any[] = [];
        for (const ur of unitRecords) {
          const unit = await UnitModel.findOne({ organizationId, code: ur.unitCode });
          if (!unit) {
            logger.warn(`[NAT Import] NAT00120: unit "${ur.unitCode}" not found — skipping`);
            addIssue({
              severity: "skip",
              scope: "unit",
              ref: ur.unitCode,
              message: `Skipped unit "${ur.unitCode}" in one or more enrolments — this unit is not in the subject file.`,
              action: `Add unit "${ur.unitCode}" to NAT00060 and re-import the same file.`
            });
            continue;
          }

          if (!classUnitsMap.has(unit.code)) {
            const unitObj = (unit as any).toObject ? (unit as any).toObject() : unit;
            classUnitsMap.set(unit.code, { ...unitObj, unitType: unitObj.unitType || "Elective" });
          }

          const statusCode = OUTCOME_CODE_REVERSE[ur.outcomeCode.padStart(2, "0")] ?? "CA";
          unitsOfCompetency.push({
            id: (unit._id as mongoose.Types.ObjectId).toString(),
            code: unit.code,
            hour: unit.hour ?? 0,
            title: unit.title,
            statusOfCompletion: statusCode,
            classStartDate: cls.startDate,
            classEndDate: cls.endDate,
            unitStartDate: parseNatDate(ur.activityStart),
            unitEndDate: parseNatDate(ur.activityEnd)
          });
        }

        if (unitsOfCompetency.length === 0) continue;

        const fullName = [student.personalInfo.givenName, student.personalInfo.surname].filter(Boolean).join(" ");
        const studentIdStr = (student._id as mongoose.Types.ObjectId).toString();
        built.push({
          studentId: studentIdStr,
          studentInfo: {
            id: studentIdStr,
            name: fullName,
            email: student.contactDetails.email,
            phone: student.contactDetails.personalPhone,
            USI: student.participantsIdentifiers?.USI
          },
          unitsOfCompetency
        });
      }

      // Imported units are all treated as electives (NAT00060 carries no core/elective split)
      const electiveUnits = Array.from(classUnitsMap.values());

      // Build an enrolment subdocument from a freshly-parsed entry
      const makeEnrollmentDoc = (b: (typeof built)[number], classId: string, title: string) => ({
        studentInfo: b.studentInfo,
        enrollmentDate: cls.startDate,
        class: { id: classId, title },
        unitsOfCompetency: b.unitsOfCompetency,
        completionDate: null,
        certificateIssuedDate: null,
        certificateId: null,
        certificateShortId: null,
        certificateKey: null
      });

      // Find this class by its deterministic key (every imported class is keyed on creation)
      const existing = await ClassModel.findOne({ organizationId, importedFromNat: true, natImportKey });

      if (!existing) {
        // ── CREATE (atomic single write — _id pre-generated so the class can't be left half-built) ──
        const classTitle = `[IMPORTED] ${qualCode} (${cls.startDate.toISOString().slice(0, 10)} to ${cls.endDate.toISOString().slice(0, 10)})`;
        const _id = new mongoose.Types.ObjectId();
        const classId = _id.toString();
        const enrollmentDocs = built.map((b) => makeEnrollmentDoc(b, classId, classTitle));

        await ClassModel.create({
          _id,
          organizationId,
          qualificationId: qualification._id,
          deliveryLocationId: delivLoc?._id,
          importedFromNat: true,
          natImportKey,
          natImportReportId: reportId,
          unitsInfo: { unitCategory: "Selected", selectedUnits: { core: [], elective: electiveUnits } },
          classDetails: {
            classTitle,
            location: legacyLoc._id,
            startDate: cls.startDate,
            endDate: cls.endDate,
            closeDays: [],
            vetInSchool: false
          },
          reportingDetails: {
            partnership: false,
            // deliveryMode from NAT00120 pos 69 (YNN/NYN/NNY etc.); fall back to "YNN" (internal/face-to-face)
            principleDeliveryMode: cls.deliveryMode?.trim() || "YNN",
            // NAT00120 does not carry principal client cohort — "@@" = not stated
            principalClientCohort: "@@",
            doNotReport: false,
            doNotReportAsqa: false
          },
          fundDetails: {
            fundingSourceNational: cls.fundNational || "20",
            fundingSourceState: cls.fundState?.trim() || " "
          },
          enrollments: enrollmentDocs
        });

        created += 1;
        enrollmentsCreated += enrollmentDocs.length;
        continue;
      }

      // ── MERGE into the existing imported class (idempotent re-import; single atomic updateOne) ──
      const obj = existing.toObject() as any;
      if (!Array.isArray(obj.enrollments)) obj.enrollments = [];
      // Preserve any manual rename — never regenerate the title on merge
      const title = obj.classDetails?.classTitle || "";
      const enrollById = new Map<string, any>(obj.enrollments.map((e: any) => [e.studentInfo?.id, e]));

      for (const b of built) {
        const ex = enrollById.get(b.studentId);
        if (!ex) {
          const doc = makeEnrollmentDoc(b, obj._id.toString(), title);
          obj.enrollments.push(doc);
          enrollById.set(b.studentId, doc);
          enrollmentsCreated += 1;
          continue;
        }
        // Union unit lines by natural key; refresh activity (import-wins) for existing lines
        const lineMap = new Map<string, any>((ex.unitsOfCompetency || []).map((u: any) => [unitLineKey(u), u]));
        for (const nu of b.unitsOfCompetency) {
          const cur = lineMap.get(unitLineKey(nu));
          if (!cur) {
            ex.unitsOfCompetency.push(nu);
          } else {
            cur.statusOfCompletion = nu.statusOfCompletion;
            cur.classStartDate = nu.classStartDate;
            cur.classEndDate = nu.classEndDate;
            cur.unitStartDate = nu.unitStartDate;
            cur.unitEndDate = nu.unitEndDate;
          }
        }
        enrollmentsUpdated += 1;
      }

      // Union electives into unitsInfo (keep any existing core/elective)
      const elective: any[] = obj.unitsInfo?.selectedUnits?.elective ?? [];
      const haveCodes = new Set(elective.map((u: any) => u.code));
      for (const [code, u] of classUnitsMap) if (!haveCodes.has(code)) elective.push(u);
      const unitsInfo = {
        unitCategory: obj.unitsInfo?.unitCategory || "Selected",
        selectedUnits: { core: obj.unitsInfo?.selectedUnits?.core ?? [], elective }
      };

      // Expand the class date window to cover the newly-imported activity (e.g. 6-mo → 12-mo)
      const startDate = cls.startDate < obj.classDetails.startDate ? cls.startDate : obj.classDetails.startDate;
      const endDate = cls.endDate > obj.classDetails.endDate ? cls.endDate : obj.classDetails.endDate;

      await ClassModel.updateOne(
        { _id: existing._id },
        {
          $set: {
            enrollments: obj.enrollments,
            unitsInfo,
            "classDetails.startDate": startDate,
            "classDetails.endDate": endDate,
            natImportReportId: reportId ?? obj.natImportReportId
          }
        }
      );
      updated += 1;
    } catch (err: unknown) {
      // Isolate the failure to this one class — keep importing the rest, report it for re-run
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[NAT Import] NAT00120 class "${natImportKey}" failed: ${msg}`);
      errors.push({ class: natImportKey, error: msg });
      addIssue({
        severity: "error",
        scope: "class",
        ref: `${qualCode} @ ${locationId}`,
        message: `Could not import the class for "${qualCode}" at "${locationId}": ${friendlyImportError(msg)}`,
        action: "Fix the issue above, then re-import the same file (already-imported records won't duplicate)."
      });
    }
  }

  return { created, updated, enrollmentsCreated, enrollmentsUpdated, enrollmentsSkipped, errors, issues };
};

// ─── NAT00130 — Completions ───────────────────────────────────────────────────

interface Nat130Record {
  qualCode: string;
  clientId: string;
  completionDate: string; // DDMMYYYY
  issuedFlag: string;
}

const parseNAT00130 = (content: string): Nat130Record[] =>
  content
    .split(/\r?\n/)
    .filter((l) => l.length >= 39)
    .map(
      (l): Nat130Record => ({
        qualCode: read(l, 11, 10),
        clientId: read(l, 21, 10),
        completionDate: read(l, 31, 8),
        issuedFlag: read(l, 39, 1)
      })
    )
    .filter((r) => r.clientId && r.qualCode);

const applyCompletions = async (
  organizationId: string,
  records: Nat130Record[]
): Promise<{ updated: number; skipped: number }> => {
  let updated = 0;
  let skipped = 0;
  for (const r of records) {
    const compDate = parseNatDate(r.completionDate);
    if (!compDate) continue;

    const student = await StudentModel.findOne({ organizationId, avetmissId: r.clientId }).select("_id");
    if (!student) {
      skipped += 1;
      continue;
    }
    const studentId = (student._id as mongoose.Types.ObjectId).toString();

    const qualification = await QualificationModel.findOne({ organizationId, code: r.qualCode }).select("_id");
    if (!qualification) {
      skipped += 1;
      continue;
    }

    // Find the class for this qual that has an enrollment for this student
    const cls = await ClassModel.findOne({
      organizationId,
      qualificationId: qualification._id,
      "enrollments.studentInfo.id": studentId
    });
    if (!cls) {
      skipped += 1;
      continue;
    }

    const res = await ClassModel.updateOne(
      { _id: cls._id, "enrollments.studentInfo.id": studentId },
      {
        $set: { "enrollments.$.completionDate": compDate, "enrollments.$.issuedFlag": r.issuedFlag === "Y" ? "Y" : "N" }
      }
    );
    if (res.modifiedCount) updated += 1;
  }
  return { updated, skipped };
};

// ─── Main orchestrator ────────────────────────────────────────────────────────

export interface NatImportSummary {
  deliveryLocations: { created: number; updated: number };
  qualifications: { created: number; updated: number };
  units: { created: number; updated: number };
  students: StudentImportResult;
  disabilityUpdates: number;
  priorEdUpdates: number;
  classes: {
    created: number;
    updated: number;
    enrollmentsCreated: number;
    enrollmentsUpdated: number;
    enrollmentsSkipped: number;
    errors: { class: string; error: string }[];
    issues: ImportIssue[];
  };
  completionUpdates: number;
  filesFound: string[];
  filesMissing: string[];
  warnings: string[];
  fileErrors: { file: string; error: string }[];
  // "ok" = everything imported cleanly; "partial" = some files/classes failed, re-run to complete (idempotent)
  status: "ok" | "partial";
  // Plain-language, de-duplicated feedback for the user: what / why / what-to-do
  issues: ImportIssue[];
}

export const importFromNatZip = async (
  organizationId: string,
  zipBuffer: Buffer,
  reportId?: string
): Promise<NatImportSummary> => {
  const zip = new AdmZip(zipBuffer);

  const getFile = (name: string): string => {
    const entry = zip.getEntries().find((e) => e.entryName.toUpperCase().endsWith(name.toUpperCase()));
    return entry ? zip.readAsText(entry) : "";
  };

  const FILE_NAMES = [
    "NAT00020.TXT",
    "NAT00030A.TXT",
    "NAT00060.TXT",
    "NAT00080.TXT",
    "NAT00085.TXT",
    "NAT00090.TXT",
    "NAT00100.TXT",
    "NAT00120.TXT",
    "NAT00130.TXT"
  ] as const;

  const nat20 = getFile("NAT00020.TXT");
  // NAT-FIX-3: some AVETMISS exports use NAT00030.TXT (no 'A'); accept both
  const nat30 = getFile("NAT00030A.TXT") || getFile("NAT00030.TXT");
  const nat60 = getFile("NAT00060.TXT");
  const nat80 = getFile("NAT00080.TXT");
  const nat85 = getFile("NAT00085.TXT");
  const nat90 = getFile("NAT00090.TXT");
  const nat100 = getFile("NAT00100.TXT");
  const nat120 = getFile("NAT00120.TXT");
  const nat130 = getFile("NAT00130.TXT");

  const fileMap: Record<string, string> = {
    "NAT00020.TXT": nat20,
    "NAT00030A.TXT": nat30,
    "NAT00060.TXT": nat60,
    "NAT00080.TXT": nat80,
    "NAT00085.TXT": nat85,
    "NAT00090.TXT": nat90,
    "NAT00100.TXT": nat100,
    "NAT00120.TXT": nat120,
    "NAT00130.TXT": nat130
  };
  const filesFound = FILE_NAMES.filter((n) => !!fileMap[n]);
  const filesMissing = FILE_NAMES.filter((n) => !fileMap[n]);

  const warnings: string[] = [];
  const fileErrors: { file: string; error: string }[] = [];

  if (!nat80) warnings.push("NAT00080.TXT not found in ZIP — no students imported");
  if (!nat120) warnings.push("NAT00120.TXT not found in ZIP — no classes created");

  // Helper: run a file-level operation with isolated error capture
  const tryFile = async <T>(file: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      fileErrors.push({ file, error: msg });
      logger.error(`[NAT Import] ${file} failed: ${msg}`);
      return fallback;
    }
  };

  // 1. Locations (must run before classes)
  const deliveryLocations = nat20
    ? await tryFile("NAT00020", () => upsertDeliveryLocations(organizationId, parseNAT00020(nat20)), {
        created: 0,
        updated: 0
      })
    : { created: 0, updated: 0 };

  // 2. Qualifications (must run before classes)
  const qualifications = nat30
    ? await tryFile("NAT00030A", () => upsertQualifications(organizationId, parseNAT00030A(nat30)), {
        created: 0,
        updated: 0
      })
    : { created: 0, updated: 0 };

  // 3. Units (must run before classes)
  const units = nat60
    ? await tryFile("NAT00060", () => upsertUnits(organizationId, parseNAT00060(nat60)), { created: 0, updated: 0 })
    : { created: 0, updated: 0 };

  // 4. Students (must run before classes)
  const nat80Records = nat80 ? parseNAT00080(nat80) : [];
  const nat85Map = nat85 ? parseNAT00085(nat85) : new Map<string, Nat85Record>();
  const students = await tryFile("NAT00080", () => upsertStudents(organizationId, nat80Records, nat85Map, reportId), {
    created: 0,
    skipped: 0,
    failed: nat80Records.length,
    errors: []
  });

  // 5. Disability types
  const disabilityUpdates = nat90
    ? await tryFile("NAT00090", () => applyDisabilityTypes(organizationId, parseNAT00090(nat90)), 0)
    : 0;

  // 6. Prior ed achievements
  const priorEdUpdates = nat100
    ? await tryFile("NAT00100", () => applyPriorEdAchievements(organizationId, parseNAT00100(nat100)), 0)
    : 0;

  // 7. Synthetic classes + enrollments — NAT-03: dependency guard
  let classes: SyntheticClassResult = {
    created: 0,
    updated: 0,
    enrollmentsCreated: 0,
    enrollmentsUpdated: 0,
    enrollmentsSkipped: 0,
    errors: [],
    issues: []
  };
  if (nat120) {
    if (qualifications.created + qualifications.updated === 0 && !nat30) {
      warnings.push(
        "NAT00120 enrolments skipped — no qualifications found. Include NAT00030A.TXT or NAT00030.TXT in the ZIP."
      );
    } else {
      classes = await tryFile(
        "NAT00120",
        () => createSyntheticClasses(organizationId, buildSyntheticClasses(parseNAT00120(nat120)), reportId),
        {
          created: 0,
          updated: 0,
          enrollmentsCreated: 0,
          enrollmentsUpdated: 0,
          enrollmentsSkipped: 0,
          errors: [],
          issues: []
        }
      );
    }
  }

  // 8. Completions
  const completions = nat130
    ? await tryFile("NAT00130", () => applyCompletions(organizationId, parseNAT00130(nat130)), {
        updated: 0,
        skipped: 0
      })
    : { updated: 0, skipped: 0 };
  const completionUpdates = completions.updated;

  // ── Assemble the user-facing feedback report (what / why / what-to-do) ──
  const issues: ImportIssue[] = [];

  // Missing critical files
  if (!nat80) {
    issues.push({
      severity: "warning",
      scope: "file",
      ref: "NAT00080",
      message: "The client file (NAT00080) is missing — no students were imported.",
      action: "Include NAT00080.TXT in the ZIP and re-import."
    });
  }
  if (!nat120) {
    issues.push({
      severity: "warning",
      scope: "file",
      ref: "NAT00120",
      message: "The enrolment file (NAT00120) is missing — no classes or enrolments were created.",
      action: "Include NAT00120.TXT in the ZIP and re-import."
    });
  }

  // File-level hard errors
  for (const fe of fileErrors) {
    issues.push({
      severity: "error",
      scope: "file",
      ref: fe.file,
      message: `Could not process ${fe.file}: ${friendlyImportError(fe.error)}`,
      action: "Check that the file matches the AVETMISS format, then re-import."
    });
  }

  // Student import failures
  for (const e of students.errors) {
    issues.push({
      severity: "error",
      scope: "student",
      ref: e.avetmissId,
      message: `Could not import student "${e.avetmissId}": ${friendlyImportError(e.reason)}`,
      action: "Fix the highlighted detail in the file and re-import the same file."
    });
  }

  // Class / enrolment skips & errors (already de-duplicated)
  issues.push(...classes.issues);

  // Completions that couldn't be attached
  if (completions.skipped > 0) {
    issues.push({
      severity: "warning",
      scope: "completion",
      message: `${completions.skipped} program completion${completions.skipped === 1 ? "" : "s"} (NAT00130) could not be matched to an enrolment.`,
      action:
        "These are usually skipped because the related student, qualification, or enrolment wasn't imported. Resolve the issues above and re-import."
    });
  }

  // Fail-loud: any file-level error, per-class error, or failed student → import is "partial".
  // Because the import is idempotent, re-running it completes the missing parts without duplicating.
  const status: "ok" | "partial" =
    fileErrors.length > 0 || classes.errors.length > 0 || students.failed > 0 ? "partial" : "ok";

  logger.info(
    `[NAT Import] org=${organizationId} status=${status} found=${filesFound.join(",")} locations=${deliveryLocations.created} quals=${qualifications.created} units=${units.created} students=${students.created} classes=${classes.created} classErrors=${classes.errors.length} fileErrors=${fileErrors.length}`
  );

  return {
    deliveryLocations,
    qualifications,
    units,
    students,
    disabilityUpdates,
    priorEdUpdates,
    classes,
    completionUpdates,
    filesFound,
    filesMissing,
    warnings,
    fileErrors,
    status,
    issues
  };
};

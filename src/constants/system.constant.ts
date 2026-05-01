import { ASQAReportType } from "../types/asqa-report.type";

export enum AccountStatus {
  UNVERIFIED = "Unverified",
  VERIFIED = "Verified",
  SUSPENDED = "Suspended",
  DEACTIVATED = "Deactivated",
  DELETED = "Deleted"
}

export const UNIT_COMPETENCY_MAP = {
  C: { code: "C", meaning: "Competency achieved/pass", numberCode: 20 },
  CNA: { code: "CNA", meaning: "Competency not achieved/fail", numberCode: 30 },
  W: { code: "W", meaning: "Withdrawn/discontinued", numberCode: 40 },
  CLOS: { code: "CLOS", meaning: "Incomplete due to RTO closure", numberCode: 41 },
  "RPL-G": { code: "RPL-G", meaning: "Recognition of prior learning granted", numberCode: 51 },
  CT: { code: "CT", meaning: "Credit transfer/national recognition", numberCode: 60 },
  SUP: { code: "SUP", meaning: "Superseded subject", numberCode: 61 },
  CA: { code: "CA", meaning: "Continuing activity", numberCode: 70 },
  NYS: { code: "NYS", meaning: "Not yet started", numberCode: 85 },
  "RPL-N": { code: "RPL-N", meaning: "Recognition of prior learning not granted", numberCode: 52 },
  "NA-P": { code: "NA-P", meaning: "Non-assessed enrolment — satisfactorily completed", numberCode: 81 },
  "NA-W": {
    code: "NA-W",
    meaning: "Non-assessed enrolment — withdrawn or not satisfactorily completed",
    numberCode: 82
  }
} as const;

export type UnitCompetencyCode = keyof typeof UNIT_COMPETENCY_MAP;

export const ENROLLED_UNIT_COMPLETED_STATUSES: UnitCompetencyCode[] = ["C", "CT", "RPL-G"];

export const ASQA_REPORT_TYPES: ASQAReportType[] = ["ALL", "DELIVERY_DATA", "STUDENT_SURVEY", "ENROLLMENT_COMPLETION"];

export enum ErrorReportRole {
  SYSTEM = "System",
  USER = "User"
}

export enum SystemServices {
  MIDDLEWARE = "Middleware",
  AUTHENTICATION = "Authentication",
  USER = "User",
  DEMO = "Demo"
}

export const separatorWords = ["in", "of", "for"];

export const certificateVerifyEndPoint = "certificate/verify";

export const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const invoiceTypes = ["AUTO", "MANUAL"] as const;

export const SUCCESS_MESSAGE = {
  RETRIEVED: "Data retrieved successfully"
};

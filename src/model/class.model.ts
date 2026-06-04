import { Prop, ModelOptions, getModelForClass } from "@typegoose/typegoose";
import mongoose, { Types } from "mongoose";
import { Unit } from "./unit.model";
import { PhoneNumber } from "./common.model";
import { Qualification } from "./qualification.model";
import { UNIT_COMPETENCY_MAP, UnitCompetencyCode } from "../constants";
import { Organization } from "./organization.model";
import { Trainer } from "./trainer.model";
import { Location } from "./location.model";

class StudentInfo {
  @Prop({
    required: true,
    type: String
  })
  id: string;

  @Prop({
    required: true
  })
  name: string;

  @Prop({
    required: true
  })
  email: string;

  @Prop({ type: () => PhoneNumber, _id: false })
  phone: PhoneNumber;

  @Prop()
  USI?: string;
}

class UnitsOfCompetency {
  @Prop({
    required: true,
    type: String
  })
  id: string;

  @Prop({
    required: true,
    type: String
  })
  code: string;

  @Prop({
    required: true,
    type: Number
  })
  hour: number;

  @Prop({
    required: true,
    type: String
  })
  title: string;

  @Prop({
    required: true,
    type: String,
    enum: Object.keys(UNIT_COMPETENCY_MAP)
  })
  statusOfCompletion: UnitCompetencyCode;

  @Prop({
    required: true,
    type: Date
  })
  classStartDate: Date;

  @Prop({
    required: true,
    type: Date
  })
  classEndDate: Date;

  @Prop({
    required: false,
    type: Date,
    default: null
  })
  unitStartDate?: Date;

  @Prop({
    required: false,
    type: Date,
    default: null
  })
  unitEndDate?: Date;

  @Prop({
    required: false,
    type: Date,
    default: null
  })
  unitEnrollmentDate?: Date;

  @Prop({
    required: false,
    type: Date,
    default: null
  })
  unitCompletionDate?: Date | null;
}

class EnrolledClass {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  title: string;
}

class Enrollments {
  @Prop({
    required: true,
    type: () => StudentInfo,
    _id: false
  })
  studentInfo: StudentInfo;

  @Prop({
    required: true,
    default: Date.now
  })
  enrollmentDate: Date;

  @Prop({
    required: true,
    type: () => EnrolledClass,
    _id: false
  })
  class: EnrolledClass;

  @Prop({
    type: Date,
    default: null
  })
  certificateIssuedDate?: Date | null;

  @Prop({
    // ref: () => Certificate,
    type: Types.ObjectId,
    default: null
  })
  certificateId?: Types.ObjectId | null;

  @Prop({
    type: String,
    required: false,
    default: null
  })
  certificateShortId: string | null;

  @Prop({
    type: String,
    required: false,
    default: null
  })
  certificateKey: string | null;

  @Prop({
    type: Date,
    required: false,
    default: null
  })
  completionDate: Date | null;

  @Prop({
    required: true,
    type: () => [UnitsOfCompetency],
    _id: false
  })
  unitsOfCompetency: UnitsOfCompetency[];

  @Prop()
  studyReason?: string;

  // Outcome per enrolment — replaces hardcoded "60" in NAT00120 pos 72 (R-20)
  @Prop({ type: String })
  outcomeIdentifierNational?: string;

  // NAT00130 pos 39 — Y when certificate issued, N otherwise (R-21)
  @Prop({ type: String, default: "N" })
  issuedFlag?: string;

  // Apprenticeship fields — NAT00120 pos 77 (trainingContractId) + pos 87 (clientId) (R-19)
  @Prop({ type: String })
  trainingContractId?: string;

  @Prop({ type: String })
  apprenticeshipClientId?: string;

  // NAT00120 pos 76 override — "3" Commencing / "4" Continuing / "8" UoC-SOA only
  // When blank, auto-derived (first class for this qual = "3", subsequent = "4")
  @Prop({ type: String, enum: ["3", "4", "8", ""], default: "" })
  commencingProgramOverride?: string;

  // NAT00120 pos 100–109 — Required when funding code is 13 or 15
  @Prop({ type: String, default: "" })
  specificFundingIdentifier?: string;

  // D2: per-enrollment program type. "FULL" → Table A (full qual), "SOA" → Table B (units only).
  // Undefined means not set (treated as FULL for backwards compat).
  @Prop({ type: String, enum: ["FULL", "SOA"] })
  enrollmentType?: "FULL" | "SOA";
}

class ClassDetails {
  @Prop({
    required: true
  })
  classTitle: string;

  @Prop({
    ref: () => Location,
    required: true
  })
  location: Types.ObjectId;

  @Prop({
    ref: () => Location
  })
  additionalLocations?: Types.ObjectId[];

  @Prop({
    required: true
  })
  startDate: Date;

  @Prop({
    required: true
  })
  endDate: Date;

  @Prop({
    required: true,
    type: () => [String]
  })
  closeDays: string[];

  @Prop({
    default: 0
  })
  minParticipants?: number;

  @Prop({
    default: 0
  })
  maxParticipants?: number;

  @Prop({
    default: 0
  })
  classFee?: number;

  @Prop()
  gst?: string;

  @Prop()
  gstAmount?: number;

  @Prop({
    ref: () => Trainer
  })
  defaultTrainer?: Types.ObjectId;
  @Prop({
    ref: () => Trainer
  })
  additionalTrainers?: Types.ObjectId[];
  @Prop({
    default: false
  })
  vetInSchool: boolean;

  // R-03: ASQA Table A = FULL_QUAL classes, Table B = SOA (individual units) classes
  @Prop({ type: String, enum: ["FULL_QUAL", "SOA"] })
  programType?: "FULL_QUAL" | "SOA";
}

class ReportingDetails {
  @Prop()
  reportingState?: string;

  @Prop()
  avetmissDeliveryMode?: string;

  @Prop({
    required: true
  })
  partnership: boolean;

  @Prop({
    required: true
  })
  principleDeliveryMode: string;

  @Prop({
    required: true
  })
  principalClientCohort: string;

  @Prop()
  legacyDeliveryMode?: string;

  @Prop({
    default: false
  })
  doNotReport: boolean;

  // Per-class ASQA opt-out; existing doNotReport field covers AVETMISS (E-05)
  @Prop({ type: Boolean, default: false })
  doNotReportAsqa?: boolean;

  @Prop()
  comment?: string;
}

class FundDetails {
  // Student-level fundingSourceNational is source of truth (R-06); this is the class-level fallback only
  @Prop()
  fundingSourceNational?: string;
  @Prop({
    required: true
  })
  fundingSourceState: string;
  @Prop()
  specificFundingIdentifier?: string;
  @Prop()
  principleFundingSourceAsqa?: string;
}

class ClassSelectedUnits {
  @Prop({ type: () => [Unit], _id: false, required: true })
  core: Unit[];

  @Prop({ type: () => [Unit], _id: false, required: true })
  elective: Unit[];
}

class ClassUnisInfo {
  @Prop({ required: true })
  unitCategory: "Selected" | "All";

  @Prop({ required: true, _id: false })
  selectedUnits: ClassSelectedUnits;
}

@ModelOptions({
  schemaOptions: {
    collection: "classes",
    timestamps: true
  }
})
export class classModel {
  @Prop({
    ref: () => Organization,
    required: true
  })
  organizationId: mongoose.Types.ObjectId;

  @Prop({
    ref: () => Qualification,
    required: true
  })
  qualificationId: mongoose.Types.ObjectId;

  @Prop({ type: () => ClassUnisInfo, _id: false })
  unitsInfo: ClassUnisInfo;

  @Prop({
    required: true,
    type: () => ClassDetails,
    _id: false
  })
  classDetails: ClassDetails;

  @Prop({
    required: true,
    type: () => ReportingDetails,
    _id: false
  })
  reportingDetails: ReportingDetails;

  @Prop({
    required: true,
    type: () => FundDetails,
    _id: false
  })
  fundDetails: FundDetails;

  @Prop({
    required: false,
    type: () => [Enrollments],
    default: [],
    _id: false
  })
  enrollments: Enrollments[];

  // Delivery location reference for NAT00020 cross-check (R-15)
  @Prop({ type: mongoose.Types.ObjectId })
  deliveryLocationId?: mongoose.Types.ObjectId;

  // ─── NAT import provenance / idempotency (SA-06) ───
  // True for synthetic classes created by the AVETMISS NAT import.
  @Prop({ type: Boolean, default: false })
  importedFromNat?: boolean;

  // Deterministic identity for an imported class = `${qualCode}||${locationId}`.
  // Lets re-import find and merge the same class instead of duplicating it.
  @Prop({ type: String })
  natImportKey?: string;

  // reportId of the AVETMISS import batch that created this class (provenance / clean rollback).
  @Prop({ type: String })
  natImportReportId?: string;
}
export const ClassModel = getModelForClass(classModel);

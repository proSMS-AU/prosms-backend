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
    default: null
  })
  certificateIssuedDate?: Date | null;

  @Prop({
    // ref: () => Certificate,
    default: null
  })
  certificateId?: Types.ObjectId | null;

  @Prop({
    required: false,
    default: null
  })
  certificateShortId: string | null;

  @Prop({
    required: false,
    default: null
  })
  certificateKey: string | null;

  @Prop({
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
    required: true
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

  @Prop()
  comment?: string;
}

class FundDetails {
  @Prop({
    required: true
  })
  fundingSourceNational: string;
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
}
export const ClassModel = getModelForClass(classModel);

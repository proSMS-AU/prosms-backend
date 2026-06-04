import { Prop, getModelForClass, ModelOptions, Index } from "@typegoose/typegoose";
import { PhoneNumber } from "./common.model";
import mongoose from "mongoose";
import { Organization } from "./organization.model";

class PersonalInfo {
  @Prop({
    required: true,
    type: String
  })
  title: string;

  // Required only for multi-name students. Single-name people (mononyms) store the
  // single name in `surname` (AVETMISS family-name field) and leave givenName blank.
  @Prop({
    required: function (this: PersonalInfo) {
      return !this.isSingleName;
    },
    type: String
  })
  givenName: string;

  @Prop({
    type: String
  })
  middleName?: string;

  @Prop({
    type: String
  })
  surname?: string;

  @Prop({
    type: Boolean,
    default: false
  })
  isSingleName?: boolean;

  @Prop({
    type: String
  })
  preferredName?: string;

  @Prop({
    required: true,
    type: String
  })
  gender: string;

  @Prop({
    required: true,
    type: String
  })
  dateOfBirth: string;
}

class VerifiedUSIData {
  @Prop({
    required: true
  })
  usiStatus: string;

  @Prop({
    required: true
  })
  firstNameMatch: boolean;

  @Prop({
    required: true
  })
  familyNameMatch: boolean;

  @Prop({
    required: true
  })
  dateOfBirthMatch: boolean;
}

class ParticipantsIdentifiers {
  @Prop()
  USI?: string;

  @Prop({
    type: () => VerifiedUSIData,
    _id: false
  })
  verifiedUsiInfo?: VerifiedUSIData;

  @Prop({
    required: true
  })
  isUSIVerified: boolean;

  @Prop()
  LUI?: string;

  @Prop()
  workReadyParticipantNumber?: string;

  @Prop()
  saceStudentId?: string;
}

class EmploymentDetails {
  @Prop()
  organization?: string;

  @Prop()
  position: string;

  @Prop()
  division: string;

  @Prop()
  section: string;
}

class ContactDetails {
  @Prop({ required: true, type: () => PhoneNumber, _id: false })
  personalPhone: PhoneNumber;

  @Prop({ type: () => PhoneNumber, _id: false })
  workPhone?: PhoneNumber;

  @Prop({ type: () => PhoneNumber, _id: false })
  homePhone?: PhoneNumber;

  @Prop({
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  })
  email: string;

  @Prop({
    trim: true,
    lowercase: true
  })
  alternateEmail?: string;

  @Prop()
  website?: string;
}

class PrimaryPostalAddress {
  @Prop()
  building?: string;

  @Prop()
  unit?: string;

  @Prop()
  street?: string;

  @Prop()
  streetNumber?: string;

  @Prop()
  streetName?: string;

  @Prop({
    type: String
  })
  POBox?: string;

  @Prop({
    required: true
  })
  city: string;

  @Prop({
    required: true
  })
  state: string;

  @Prop({
    required: true
  })
  postCode: string;

  @Prop({
    required: true
  })
  country: string;
}

class PrimaryStreetAddress {
  @Prop()
  building?: string;

  @Prop()
  unit?: string;

  @Prop()
  street?: string;

  @Prop()
  streetNumber?: string;

  @Prop()
  streetName?: string;

  @Prop()
  POBox?: string;

  @Prop({
    required: true
  })
  city: string;

  @Prop({
    required: true
  })
  state: string;

  @Prop({
    required: true
  })
  postCode: string;

  @Prop({
    required: true
  })
  country: string;
}

class Address {
  @Prop({
    default: false
  })
  arePostalStreetAddressSame: boolean;

  @Prop({
    required: true,
    type: () => PrimaryPostalAddress,
    _id: false
  })
  primaryPostalAddress: PrimaryPostalAddress;

  @Prop({
    required: true,
    type: () => PrimaryStreetAddress,
    _id: false
  })
  primaryStreetAddress: PrimaryStreetAddress;
}

class PriorEducationalAchievement {
  @Prop({ required: true, type: String })
  code: string;

  @Prop({ required: true, type: String })
  completedYear: string;
}

class VETDetails {
  @Prop({
    required: true
  })
  birthCountry: string;

  @Prop({
    required: true
  })
  birthCity: string;

  @Prop()
  citizenshipCountry?: string;

  @Prop()
  ausCitizenshipStatus?: string;

  @Prop()
  residencyStatus?: string;

  @Prop({
    required: true
  })
  abOriginalOrigin: string;

  @Prop()
  employmentStatus?: string;

  @Prop()
  occupations?: string;

  @Prop()
  employmentIndustry?: string;

  @Prop()
  language?: string;

  @Prop()
  englishProficiency?: string;

  @Prop()
  englishAssistance?: boolean;

  @Prop()
  atSchool?: boolean;

  @Prop()
  educationLevel?: string;

  @Prop({
    type: () => [PriorEducationalAchievement],
    _id: false,
    default: []
  })
  priorEducationalAchievements?: PriorEducationalAchievement[];

  @Prop({
    default: false
  })
  disabilities?: boolean;

  @Prop({
    default: false
  })
  priorEducation?: boolean;

  @Prop()
  surveyContactStatus?: string;

  @Prop({ type: () => [String], default: [] })
  disabilityTypes?: string[];
}

class EmergencyContact {
  @Prop()
  name?: string;

  @Prop()
  relation?: string;

  @Prop({ type: () => PhoneNumber, _id: false })
  phone?: PhoneNumber;
}

class Parent {
  @Prop()
  name?: string;

  @Prop({
    trim: true,
    lowercase: true
  })
  email?: string;

  @Prop({ type: () => PhoneNumber, _id: false })
  phone?: PhoneNumber;
}

class AdditionalInformation {
  @Prop()
  source?: string;

  @Prop()
  internationalContact?: string;

  @Prop()
  coach?: string;

  @Prop()
  manager?: string;

  @Prop()
  employer?: string;

  @Prop()
  agent?: string;

  @Prop()
  payer?: string;

  @Prop()
  contactCategories?: string;

  @Prop()
  comment?: string;

  @Prop()
  noteType?: string;

  @Prop()
  contactStatus?: string;
}

@Index({ organizationId: 1, studentId: 1 }, { unique: true })
@ModelOptions({
  schemaOptions: {
    collection: "students",
    timestamps: true,
    versionKey: false
  }
})
export class Student {
  @Prop({
    ref: () => Organization
  })
  organizationId?: mongoose.Types.ObjectId;

  @Prop({
    required: true
  })
  studentId: string;

  @Prop()
  avetmissId?: string;

  @Prop({
    required: true,
    type: () => PersonalInfo,
    _id: false
  })
  personalInfo: PersonalInfo;

  @Prop({
    type: () => EmploymentDetails,
    _id: false
  })
  employmentDetails?: EmploymentDetails;

  @Prop({
    required: true,
    type: () => ContactDetails,
    _id: false
  })
  contactDetails: ContactDetails;

  @Prop({
    required: true,
    type: () => Address,
    _id: false
  })
  address: Address;

  @Prop({
    required: true,
    type: () => VETDetails,
    _id: false
  })
  vetDetails: VETDetails;

  @Prop({
    required: true,
    type: () => ParticipantsIdentifiers,
    _id: false
  })
  participantsIdentifiers: ParticipantsIdentifiers;

  @Prop({
    type: () => [EmergencyContact],
    _id: false
  })
  emergencyContacts?: EmergencyContact[];

  @Prop({
    type: () => [Parent],
    _id: false
  })
  parents?: Parent[];

  @Prop({
    type: () => AdditionalInformation,
    _id: false
  })
  additionalInformation?: AdditionalInformation;

  // Soft-delete support — deleted students stay in reports (R-01, R-10)
  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;

  // Per-student AVETMISS opt-out (R-11)
  @Prop({ type: Boolean, default: false })
  doNotReportAvetmiss?: boolean;

  // Funding source at student level; class fundDetails is the fallback default (R-06)
  @Prop({ type: String })
  fundingSourceNational?: string;

  // Apprenticeship flag — shows apprenticeship panel in enrolment form (R-19)
  @Prop({ type: Boolean, default: false })
  isApprentice?: boolean;

  // Set to true for students created via NAT file import (SA-06)
  @Prop({ type: Boolean, default: false })
  importedFromNat?: boolean;
}

export const StudentModel = getModelForClass(Student);

import z, { object, boolean, string, array } from "zod";
import { alternatePhoneSchema, phoneSchema } from "./common.schema";

const MIN_AGE_YEARS = 10;

/**
 * Returns true if the dateOfBirth string puts the student under MIN_AGE_YEARS as of today.
 * Returns false for blank/unparseable values (those are handled by other rules).
 */
const isUnderMinAge = (dateOfBirth: string | undefined): boolean => {
  const raw = (dateOfBirth ?? "").trim();
  if (!raw) return false;
  const dob = new Date(raw);
  if (isNaN(dob.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - MIN_AGE_YEARS);
  return dob.getTime() > cutoff.getTime();
};

const AGE_MESSAGE = `Student must be at least ${MIN_AGE_YEARS} years old`;

const PersonalInfoSchema = object({
  title: string().min(1, "Title is required"),
  givenName: string().optional(),
  middleName: string().optional(),
  surname: string().optional(),
  isSingleName: boolean().optional(),
  preferredName: string().optional(),
  gender: string().min(1, "Gender is required"),
  dateOfBirth: string().min(1, "Date of birth is required")
}).superRefine((data, ctx) => {
  // Age guard: do not accept students under the minimum age (client requirement).
  if (isUnderMinAge(data.dateOfBirth)) {
    ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: AGE_MESSAGE });
  }
  // Mononym (single name): the one name lives in `surname` (AVETMISS family name); given name not required.
  if (data.isSingleName) {
    if (!data.surname?.trim()) {
      ctx.addIssue({ code: "custom", path: ["surname"], message: "Name is required" });
    }
    return;
  }
  // Multi-name: both given name and surname are required.
  if (!data.givenName?.trim()) {
    ctx.addIssue({ code: "custom", path: ["givenName"], message: "Given name is required" });
  }
  if (!data.surname?.trim()) {
    ctx.addIssue({ code: "custom", path: ["surname"], message: "Surname is required" });
  }
});

const EmploymentDetailsSchema = object({
  organization: string().optional(),
  position: string().optional(),
  division: string().optional(),
  section: string().optional()
});

const verifiedUsiInfoSchema = object({
  usiStatus: string({ error: "USI status is required" }).min(1, "USI status must be selected"),
  firstNameMatch: boolean({ error: "First name match is required" }),
  familyNameMatch: boolean({ error: "Family name match is required" }),
  dateOfBirthMatch: boolean({ error: "Date of birth match is required" })
});

const ParticipantsIdentifiersSchema = object({
  USI: string().optional(),
  verifiedUsiInfo: verifiedUsiInfoSchema.optional(),
  isUSIVerified: boolean({ error: "USI verification status is required" }),
  LUI: string().optional(),
  workReadyParticipantNumber: string().optional(),
  saceStudentId: string().optional(),
  oscaIdentifier: string().max(6).optional()
}).refine(
  (data) => {
    if (data.isUSIVerified) {
      return data.USI && data.USI.trim() !== "";
    }
  },
  {
    message: "USI is required when USI is verified"
  }
);

const ContactDetailsSchema = object({
  personalPhone: phoneSchema,
  workPhone: alternatePhoneSchema,
  homePhone: alternatePhoneSchema,
  email: string().email("Invalid email format"),
  alternateEmail: string().email("Invalid alternate email").optional().or(string().length(0)),
  website: string().url("Invalid website URL").optional().or(string().length(0))
});

const PrimaryPostalAddressSchema = object({
  building: string().optional(),
  unit: string().optional(),
  street: string().optional(),
  streetNumber: string().max(15).optional(),
  streetName: string().max(70).optional(),
  POBox: string().optional(),
  city: string().min(1, "City is required"),
  state: string().min(1, "State is required"),
  postCode: string().min(1, "Post code is required"),
  country: string().min(1, "Country is required")
});

const PrimaryStreetAddressSchema = object({
  building: string().optional(),
  unit: string().optional(),
  street: string().optional(),
  streetNumber: string().max(15).optional(),
  streetName: string().max(70).optional(),
  POBox: string().optional(),
  city: string().optional(),
  state: string().optional(),
  postCode: string().optional(),
  country: string().optional()
});

const AddressSchema = object({
  arePostalStreetAddressSame: boolean(),
  primaryPostalAddress: PrimaryPostalAddressSchema,
  primaryStreetAddress: PrimaryStreetAddressSchema
});

const PriorEducationalAchievementSchema = object({
  code: string().min(1, "Code must be at least 1 character"),
  completedYear: string().min(2, "Completed year must be at least 2 characters")
});

// AVETMISS NAT00080 valid Highest School Level Completed codes
const VALID_EDUCATION_LEVEL_CODES = ["02", "08", "09", "10", "11", "12", "@@"] as const;

const VETDetailsSchema = object({
  birthCountry: string().min(1, "Birth country is required"),
  birthCity: string().min(1, "Birth city is required"),
  citizenshipCountry: string().optional(),
  ausCitizenshipStatus: string().optional(),
  residencyStatus: string().optional(),
  abOriginalOrigin: string().min(1, "Aboriginal origin is required"),
  employmentStatus: string().optional(),
  occupations: string().optional(),
  employmentIndustry: string().optional(),
  language: string().optional(),
  englishProficiency: string().optional(),
  englishAssistance: boolean().optional(),
  atSchool: boolean().optional(),
  educationLevel: string().optional().refine(
    (val) => !val || VALID_EDUCATION_LEVEL_CODES.includes(val as typeof VALID_EDUCATION_LEVEL_CODES[number]),
    { message: `Education level must be one of: ${VALID_EDUCATION_LEVEL_CODES.join(", ")}` }
  ),
  // completedYear: string().optional(),
  priorEducationalAchievements: array(PriorEducationalAchievementSchema).optional(),
  disabilities: boolean().nullable().default(null),
  disabilityTypes: array(string()).optional(),
  priorEducation: boolean().nullable().default(null),
  surveyContactStatus: string().optional()
}).refine(
  (data) => {
    if (data.disabilities === true && data.disabilityTypes && data.disabilityTypes.length === 0) {
      return false;
    }
    return true;
  },
  {
    message: "Disability types are required when disabilities is true",
    path: ["disabilityTypes"]
  }
);

const EmergencyContactItemSchema = object({
  name: string().optional(),
  relation: string().optional(),
  phone: object({
    countryCode: string().optional(),
    number: string().optional(),
    formattedNumber: string().optional()
  })
}).optional();

const EmergencyContactsSchema = array(EmergencyContactItemSchema)
  .min(1, "At least one emergency contact is required")
  .max(5, "Maximum 5 emergency contacts allowed");

const ParentSchema = object({
  contact: string().optional(),
  name: string().optional(),
  email: string().optional(),
  phone: object({
    countryCode: string().optional(),
    number: string().optional(),
    formattedNumber: string().optional()
  }).optional()
}).optional();

const ParentsSchema = array(ParentSchema)
  .min(1, "At least one guardian info is required")
  .max(5, "Maximum 5 guardian info allowed");

const AdditionalInformationSchema = object({
  source: string().optional(),
  internationalContact: string().optional(),
  coach: string().optional(),
  manager: string().optional(),
  employer: string().optional(),
  agent: string().optional(),
  payer: string().optional(),
  contactCategories: string().optional(),
  comment: string().optional(),
  noteType: string().optional(),
  contactStatus: string().optional()
}).optional();

export const StudentSchema = object({
  organizationId: string().optional(),
  avetmissId: string().optional(),
  personalInfo: PersonalInfoSchema,
  employmentDetails: EmploymentDetailsSchema,
  contactDetails: ContactDetailsSchema,
  address: AddressSchema,
  vetDetails: VETDetailsSchema,
  participantsIdentifiers: ParticipantsIdentifiersSchema,
  emergencyContacts: EmergencyContactsSchema,
  parents: ParentsSchema,
  additionalInformation: AdditionalInformationSchema,
  // AVETMISS reporting flags
  doNotReportAvetmiss: boolean().optional(),
  isApprentice: boolean().optional(),
  fundingSourceNational: string().optional(),
  specificFundingIdentifier: string().optional()
});

// UPDATE SCHEMA - everything optional (deep partial manually)
export const UpdateStudentSchema = object({
  personalInfo: object({
    title: string().optional(),
    givenName: string().optional(),
    middleName: string().optional(),
    surname: string().optional(),
    preferredName: string().optional(),
    optionalId: string().optional(),
    dateOfBirth: string().optional(),
    organization: string().optional(),
    position: string().optional(),
    division: string().optional(),
    section: string().optional()
  })
    .superRefine((data, ctx) => {
      if (isUnderMinAge(data.dateOfBirth)) {
        ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: AGE_MESSAGE });
      }
    })
    .optional(),

  employmentDetails: object({
    organization: string().optional(),
    position: string().optional(),
    division: string().optional(),
    section: string().optional()
  }).optional(),

  contactDetails: object({
    workPhone: alternatePhoneSchema,
    personalPhone: alternatePhoneSchema,
    homePhone: alternatePhoneSchema,
    email: string().email("Invalid email format").optional(),
    alternateEmail: string().optional(),
    website: string().optional()
  }).optional(),

  address: object({
    arePostalStreetAddressSame: boolean().optional(),
    primaryPostalAddress: object({
      building: string().optional(),
      unit: string().optional(),
      street: string().optional(),
      POBox: string().optional(),
      city: string().optional(),
      state: string().optional(),
      postCode: string().optional(),
      country: string().optional()
    }).optional(),
    primaryStreetAddress: object({
      building: string().optional(),
      unit: string().optional(),
      street: string().optional(),
      POBox: string().optional(),
      city: string().optional(),
      state: string().optional(),
      postCode: string().optional(),
      country: string().optional()
    }).optional()
  }).optional(),

  vetDetails: object({
    gender: string().optional(),
    birthCountry: string().optional(),
    birthCity: string().optional(),
    citizenshipCountry: string().optional(),
    ausCitizenshipStatus: string().optional(),
    residencyStatus: string().optional(),
    abOriginalOrigin: string().optional(),
    employmentStatus: string().optional(),
    occupations: string().optional(),
    employmentIndustry: string().optional(),
    language: string().optional(),
    englishProficiency: string().optional(),
    // Tri-state flags: true / false / null (not stated) — imported students carry null
    englishAssistance: boolean().nullable().optional(),
    atSchool: boolean().nullable().optional(),
    educationLevel: string().optional(),
    priorEducationalAchievements: array(PriorEducationalAchievementSchema).optional(),
    disabilities: boolean().nullable().optional(),
    disabilityTypes: array(string()).optional(),
    priorEducation: boolean().nullable().optional(),
    surveyContactStatus: string().optional(),
    position: string().optional(),
    division: string().optional(),
    section: string().optional()
  }).optional(),

  participantsIdentifiers: object({
    USI: string().optional(),
    LUI: string().optional(),
    workReadyParticipantNumber: string().optional(),
    saceStudentId: string().optional()
  }).optional(),

  emergencyContacts: array(
    object({
      name: string().optional(),
      relation: string().optional(),
      phone: alternatePhoneSchema
    })
  ).optional(),

  parents: array(
    object({
      contact: string().optional(),
      name: string().optional(),
      email: string().email("Invalid parent email").optional(),
      phone: alternatePhoneSchema
    })
  ).optional(),

  additionalInformation: object({
    source: string().optional(),
    internationalContact: string().optional(),
    coach: string().optional(),
    manager: string().optional(),
    employer: string().optional(),
    agent: string().optional(),
    payer: string().optional(),
    contactCategories: string().optional(),
    comment: string().optional(),
    noteType: string().optional(),
    contactStatus: string().optional()
  }).optional(),
  // AVETMISS reporting flags
  doNotReportAvetmiss: boolean().optional(),
  isApprentice: boolean().optional(),
  fundingSourceNational: string().optional(),
  specificFundingIdentifier: string().optional()
});

export const StudentRequestSchema = object({
  body: StudentSchema,
  query: object({}),
  params: object({})
});

export const UpdateStudentRequestSchema = object({
  body: UpdateStudentSchema,
  query: object({}),
  params: object({})
});

export type AddStudentT = z.infer<typeof StudentSchema>;
export type UpdateStudentT = z.infer<typeof UpdateStudentSchema>;

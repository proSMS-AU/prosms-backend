import z, { object, string, number, boolean, array, enum as enum_, coerce } from "zod";
import { Types } from "mongoose";
import { UnitSchema } from "./unit.schema";
import { QualificationSchema } from "./qualification.schema";
import { UNIT_COMPETENCY_MAP } from "../constants";

// Helper schema for MongoDB ObjectId validation
const ObjectIdSchema = string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid ObjectId"
});

const UnitCompetencyEnum = enum_(
  Object.keys(UNIT_COMPETENCY_MAP) as [keyof typeof UNIT_COMPETENCY_MAP, ...(keyof typeof UNIT_COMPETENCY_MAP)[]]
);

// Units Info Schema
const UnitsInfoSchema = object({
  unitCategory: enum_(["All", "Selected"]),
  selectedUnits: object({
    core: array(UnitSchema),
    elective: array(UnitSchema)
  })
});

// Class Details Schema - Fixed to match frontend and backend model
const ClassDetailsSchema = object({
  classTitle: string().min(1, "Class title is required"),
  location: string().min(1, "Location is required"),
  startDate: coerce.date(),
  endDate: coerce.date(),
  closeDays: array(string()),
  minParticipants: number().default(0),
  maxParticipants: number().default(0),
  classFee: number().default(0),
  gst: string().optional(),
  gstAmount: number().min(0, "GST amount must be 0 or greater").optional(),
  defaultTrainer: string().optional().nullable().default(null),
  additionalTrainers: array(ObjectIdSchema).optional().default([]),
  additionalLocations: array(string()).default([]),
  vetInSchool: boolean().default(false)
})
  .refine(
    (data: { startDate: Date; endDate: Date }) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      message: "End date must be after or equal to start date",
      path: ["endDate"]
    }
  )
  .refine(
    (data: { maxParticipants: number; minParticipants: number }) => {
      return data.maxParticipants >= data.minParticipants;
    },
    {
      message: "Maximum participants must be greater than or equal to minimum participants",
      path: ["maxParticipants"]
    }
  );

// Reporting Details Schema
const ReportingDetailsSchema = object({
  reportingState: string().optional(),
  avetmissDeliveryMode: string().optional(),
  principleDeliveryMode: string({ error: "Principle delivery mode is required" }).min(
    1,
    "Principle delivery mode must be selected"
  ),
  principalClientCohort: string({ error: "Principal client cohort is required" }).min(
    1,
    "Principal client cohort must be selected"
  ),
  partnership: boolean({ error: "Partnership is required" }),
  legacyDeliveryMode: string().optional(),
  comment: string().optional(),
  doNotReport: boolean().default(false)
});

// Fund Details Schema
const FundDetailsSchema = object({
  fundingSourceNational: string().min(1, "National funding source is required"),
  fundingSourceState: string().min(1, "State funding source is required"),
  specificFundingIdentifier: string().max(10, "Specific funding identifier must be at most 10 characters").optional(),
  principleFundingSourceAsqa: string().optional()
}).superRefine((data, ctx) => {
  const national = (data.fundingSourceNational ?? "").trim();
  const specificId = (data.specificFundingIdentifier ?? "").trim();

  if (national === "13" && !specificId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["specificFundingIdentifier"],
      message: "Specific funding identifier is required when national funding source is 13"
    });
  }
});

const EnrollmentsSchema = object({
  studentInfo: object({
    id: ObjectIdSchema,
    name: string().min(1, "Student name is required"),
    email: string().min(1, "Student email is required"),
    phone: object({
      countryCode: string().min(1, "Country code is required"),
      number: string().min(1, "Phone number is required"),
      formattedNumber: string().optional()
    }),
    USI: string({ error: "USI is required" }).min(1, "USI must be at least 3 character long")
  }),
  enrollmentDate: coerce
    .date()
    .default(() => new Date())
    .nullable(),
  certificateIssuedDate: string().nullable().default(null),
  class: object({
    id: string().min(1, "Class ID is required"),
    title: string().min(1, "Class title is required")
  }),
  certificateId: string().nullable().default(null),
  certificateKey: string().nullable().default(null),
  certificateShortId: string().nullable().default(null),
  unitsOfCompetency: array(
    object({
      id: string().optional(),
      code: string().min(1, "Unit code is required"),
      hour: number().min(1, "Unit hour is required"),
      title: string().min(1, "Unit title is required"),
      statusOfCompletion: UnitCompetencyEnum,
      classStartDate: coerce.date(),
      classEndDate: coerce.date(),
      unitStartDate: coerce.date().optional(),
      unitEndDate: coerce.date().optional(),
      unitEnrollmentDate: coerce.date().min(1, "Unit enrollment date is required"),
      unitCompletionDate: coerce.date().optional()
    })
  ),
  completionDate: string().nullable().default(null),
  studyReason: string().optional(),
  outcomeIdentifierNational: string().optional(),
  issuedFlag: string().optional(),
  // Apprenticeship fields — NAT00120 pos 77/87 (max 10 chars each, both-or-neither)
  trainingContractId: string().max(10, "Training contract ID must be at most 10 characters").optional(),
  apprenticeshipClientId: string().max(10, "Apprenticeship client ID must be at most 10 characters").optional(),
  // NAT00120 pos 76 override — blank = auto-derive; "3"=commencing, "4"=continuing, "8"=UoC/SOA
  commencingProgramOverride: string().optional()
}).superRefine((data, ctx) => {
  const hasContract = !!(data.trainingContractId ?? "").trim();
  const hasClient = !!(data.apprenticeshipClientId ?? "").trim();
  if (hasContract !== hasClient) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [hasContract ? "apprenticeshipClientId" : "trainingContractId"],
      message: "Both Training Contract ID and Apprenticeship Client ID must be provided together"
    });
  }
});

// Main Class Schema
export const ClassSchema = object({
  qualificationId: ObjectIdSchema,
  unitsInfo: UnitsInfoSchema,
  classDetails: ClassDetailsSchema,
  reportingDetails: ReportingDetailsSchema,
  fundDetails: FundDetailsSchema,
  enrollments: array(EnrollmentsSchema).nullable().optional(),
  deliveryLocationId: ObjectIdSchema.optional()
});

export const DeleteUnitsFromClassEnrollmentSchema = object({
  classId: string({ error: "Class ID is required" }).min(1, "Class ID is required"),
  studentIds: array(string({ error: "Student ID is required" })).min(1, "At least one student ID is required"),
  unitIds: array(string({ error: "Unit ID is required" })).min(1, "At least one unit ID is required"),
});

// Update Class Schema - Deep Partial with proper nested objects
const UpdateQualificationSchema = QualificationSchema.partial();
const UpdateUnitsInfoSchema = UnitsInfoSchema.partial();
const UpdateClassDetailsSchema = ClassDetailsSchema.partial();
const UpdateReportingDetailsSchema = ReportingDetailsSchema.partial();
const UpdateFundDetailsSchema = FundDetailsSchema.partial();

export const UpdateClassSchema = object({
  qualificationId: string().optional(),
  unitsInfo: UpdateUnitsInfoSchema.optional(),
  classDetails: UpdateClassDetailsSchema.optional(),
  reportingDetails: UpdateReportingDetailsSchema.optional(),
  fundDetails: UpdateFundDetailsSchema.optional(),
  enrollments: array(EnrollmentsSchema).nullable().optional(),
  deliveryLocationId: ObjectIdSchema.optional()
});

// Request Schemas for Express
export const ClassRequestSchema = object({
  body: ClassSchema,
  query: object({}),
  params: object({})
});

export const DeleteUnitsFromClassEnrollmentRequestSchema = object({
  body: DeleteUnitsFromClassEnrollmentSchema,
  query: object({}),
  params: object({})
});


export const ClassUpdateRequestSchema = object({
  body: UpdateClassSchema,
  query: object({}),
  params: object({
    id: string().min(1, "Class ID is required")
  })
});

// Type exports
export type AddClassT = z.infer<typeof ClassSchema>;
export type UpdateClassT = z.infer<typeof UpdateClassSchema>;
export type QualificationT = z.infer<typeof QualificationSchema>;
export type UnitT = z.infer<typeof UnitSchema>;
export type UnitsInfoT = z.infer<typeof UnitsInfoSchema>;
export type ClassDetailsT = z.infer<typeof ClassDetailsSchema>;
export type ReportingDetailsT = z.infer<typeof ReportingDetailsSchema>;
export type FundDetailsT = z.infer<typeof FundDetailsSchema>;
export type EnrollmentsT = z.infer<typeof EnrollmentsSchema>;
export type DeleteUnitsFromClassEnrollmentT = z.infer<typeof DeleteUnitsFromClassEnrollmentSchema>;

interface forAStu {
  id: string;
  enrollmentDate: Date;
  completionDate: Date;
}
export interface IUpdateCourseEnrollAndCompleteDate {
  classId: string;
  students: forAStu[];
}
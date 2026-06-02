import { z, object, string } from "zod";

const enrollmentSchema = object({
  classId: string({ error: "Class ID is required" }).min(1, "Class ID must be at least 1 character long"),
  studentId: string({ error: "Student ID is required" }).min(1, "Student ID must be at least 1 character long"),
  unitIds: string({ error: "Unit IDs are required" }).array().min(1, "At least one unit must be selected"),
  studyReason: string().optional(),
  // Apprenticeship fields — NAT00120 pos 77/87, max 10 chars each, both-or-neither
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

const enrollmentWithNotifySchema = enrollmentSchema.safeExtend({
  email: string({ error: "Email is required" }).email("Invalid email address")
});

// Request Schemas for Express
const EnrollmentRequestSchema = object({
  body: enrollmentSchema,
  query: object({}),
  params: object({})
});

const EnrollmentWithNotifyRequestSchema = object({
  body: enrollmentWithNotifySchema,
  query: object({}),
  params: object({})
});

export const enrollmentRequestSchema = {
  enrollment: EnrollmentRequestSchema,
  enrollmentWithNotify: EnrollmentWithNotifyRequestSchema
};

export type EnrollmentT = z.infer<typeof enrollmentSchema>;
export type EnrollmentWithNotifyT = z.infer<typeof enrollmentWithNotifySchema>;

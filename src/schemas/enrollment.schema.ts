import { z, object, string } from "zod";

const enrollmentSchema = object({
  classId: string({ error: "Class ID is required" }).min(1, "Class ID must be at least 1 character long"),
  studentId: string({ error: "Student ID is required" }).min(1, "Student ID must be at least 1 character long"),
  unitIds: string({ error: "Unit IDs are required" }).array().min(1, "At least one unit must be selected")
});

const enrollmentWithNotifySchema = enrollmentSchema.extend({
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

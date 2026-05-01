import z, { object, string, enum as zenum } from "zod";

const ReportTypeEnum = zenum(["ALL", "DELIVERY_DATA", "STUDENT_SURVEY", "ENROLLMENTS"]);

const GenerateASQAReportSchema = object({
  reportType: ReportTypeEnum,
  startDate: string().datetime({ message: "Invalid startDate format" }),
  endDate: string().datetime({ message: "Invalid endDate format" }),
  completedBy: string().min(1, "Completed By is required")
});

export const GenerateASQARequestSchema = object({
  body: GenerateASQAReportSchema,
  query: object({}),
  params: object({})
});

export type GenerateASQAReportT = z.infer<typeof GenerateASQAReportSchema>;

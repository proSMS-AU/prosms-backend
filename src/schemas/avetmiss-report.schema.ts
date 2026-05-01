import z, { object, string } from "zod";

export const GenerateAvetmissReportSchema = object({
  startDate: string().min(1, "Start date is required"), // ISO date string: "2025-01-01"
  endDate: string().min(1, "End date is required"), // ISO date string: "2025-12-31"
  periodLabel: string().optional() // e.g. "Jan – Jun 2025"
});
export const GenerateAvetmissReportRequestSchema = object({
  body: GenerateAvetmissReportSchema,
  query: object({}),
  params: object({})
});
export type GenerateAvetmissReportT = z.infer<typeof GenerateAvetmissReportSchema>;

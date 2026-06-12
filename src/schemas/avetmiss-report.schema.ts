import z, { object, string, boolean, enum as zenum } from "zod";

export const GenerateAvetmissReportSchema = object({
  startDate: string().min(1, "Start date is required"),
  endDate: string().min(1, "End date is required"),
  periodLabel: string().optional(),
  destination: zenum(["NCVER", "STA"]),
  destinationState: string().optional(),
  force: boolean().optional()
});
export const GenerateAvetmissReportRequestSchema = object({
  body: GenerateAvetmissReportSchema,
  query: object({}),
  params: object({})
});
export type GenerateAvetmissReportT = z.infer<typeof GenerateAvetmissReportSchema>;

import { z, string, object, enum as enum_, array, boolean, number } from "zod";

export const UnitSchema = object({
  qualificationId: string().optional(),
  organizationId: string().optional(),
  id: string().optional(),
  code: string().min(1, "Unit code is required"),
  hour: number().min(1, "Unit hour is required").default(10),
  hasPreRequisites: boolean(),
  isEssential: boolean(),
  isEssentialLabel: enum_(["Elective", "Core"]),
  links: array(
    object({
      rel: string().optional(),
      href: string().optional()
    })
  )
    .nullable()
    .optional(),
  qualificationCode: string().optional(),
  title: string().min(1, "Unit title is required"),
  usageRecommendation: string().min(1, "Usage recommendation is required"),
  usageRecommendationLabel: string().min(1, "Usage recommendation label is required"),
  status: string({ error: "Unit status is required" }).min(1, "TGA status is required"),
  unitType: enum_(["Core", "Elective", "Custom", "Other"]).optional()
});

export const UnitCreateRequestSchema = object({
  body: UnitSchema,
  query: object({}),
  params: object({})
});

export const UpdateUnitRequestSchema = object({
  body: UnitSchema.partial(),
  query: object({}),
  params: object({})
});

// Batch Create Schemas
export const batchCreateUnitsSchema = object({
  organizationId: string().min(1),
  qualificationId: string().min(1),
  units: array(UnitSchema.omit({ organizationId: true, qualificationId: true })).min(1)
});

export type IUnit = z.infer<typeof UnitSchema>;
export type ICreateUnit = z.infer<typeof UnitCreateRequestSchema>;
export type IUpdateUnit = z.infer<typeof UpdateUnitRequestSchema>;

export type IBatchCreateUnits = z.infer<typeof batchCreateUnitsSchema>;

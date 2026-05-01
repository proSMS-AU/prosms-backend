import { z, string, object, number, array } from "zod";
import { UnitSchema } from "./unit.schema";

export const QualificationSchema = object({
  organizationId: string().optional(),
  code: string().min(1, "Qualification code is required"),
  title: string().min(1, "Qualification title is required"),
  status: string().min(1, "TGA status is required"),
  stream: string().optional().default(" "),
  latestReleaseInfo: object({
    id: string().optional(),
    releaseDate: string().optional(),
    releaseNumber: string().optional(),
    packageInformation: object({
      core: string().optional(),
      elective: string().optional(),
      measure: string().optional()
    })
      .nullable()
      .optional(),
    workPlacementHours: number().nullable().optional()
  }).optional(),
  nominalHours: number().optional()
});

const QualificationCreateSchema = object({
  qualification: QualificationSchema,
  units: array(UnitSchema),
  organizationId: string().optional()
});

const QualificationUpdateSchema = object({
  qualification: QualificationSchema,
  units: array(UnitSchema).optional()
});

export const QualificationCreateRequestSchema = object({
  body: QualificationCreateSchema,
  query: object({}),
  params: object({})
});

export const QualificationUpdateRequestSchema = object({
  body: QualificationUpdateSchema,
  query: object({}),
  params: object({
    id: string().min(1, "Qualification ID is required")
  })
});

export type IQualification = z.infer<typeof QualificationSchema>;
export type IQualificationUpdate = z.infer<typeof QualificationUpdateSchema>;
export type IQualificationCreate = z.infer<typeof QualificationCreateSchema>;

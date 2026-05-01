import { object, z } from "zod";

const trimmedString = (fieldName: string, min: number, max: number) =>
  z
    .string({error: `${fieldName} is required`})
    .trim()
    .min(min, { message: `${fieldName} must be at least ${min} characters` })
    .max(max, { message: `${fieldName} cannot exceed ${max} characters` });

const optionalTrimmedString = (fieldName: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, { message: `${fieldName} must be at least ${min} characters` })
    .max(max, { message: `${fieldName} cannot exceed ${max} characters` })
    .optional()
    .transform((val) => (val === "" ? undefined : val));

export const locationAddSchema = z.object({
  addressLine: trimmedString("Address Line", 3, 80),
  building: optionalTrimmedString("Building", 3, 40),
  unit: optionalTrimmedString("Unit", 1, 40),
  street: optionalTrimmedString("Street", 3, 40),
  POBox: optionalTrimmedString("PO Box", 3, 40),
  city: optionalTrimmedString("City", 2, 40),
  state: optionalTrimmedString("State", 2, 40),
  postcode: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Postcode must be 4 digits")
    .optional(),
  country: trimmedString("Country", 2, 25)
});

export type LocationT = z.infer<typeof locationAddSchema>;

// Request Schemas for Express
export const LocationRequestSchema = object({
  body: locationAddSchema,
  query: object({}),
  params: object({})
});

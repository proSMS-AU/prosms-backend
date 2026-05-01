import z, { boolean, coerce, object, string } from "zod";
import { alternatePhoneSchema, phoneSchema } from "./common.schema";

const PersonalInfoSchema = object({
  givenName: string().min(1, "Given name is required"),
  middleName: string().optional(),
  surname: string().min(1, "Surname is required"),
  preferredName: string().optional(),
  email: string().email("Invalid email format"),
  phone: phoneSchema,
  currentlyWorking: boolean().default(true),
  startingDate: coerce.date().optional(),
  endDate: coerce.date().optional()
});

const AddressSchema = object({
  building: string().optional(),
  unit: string().optional(),
  street: string().min(1, "Street is required"),
  POBox: string().optional(),
  city: string().min(1, "City is required"),
  state: string().min(1, "State is required"),
  postCode: string().min(1, "Post code is required"),
  country: string().min(1, "Country is required")
});

export const TrainerSchema = object({
  organizationId: string().optional(),
  // employeeId: string().min(1, "Employee ID is required"),
  personalInfo: PersonalInfoSchema,
  address: AddressSchema
});

// UPDATE SCHEMA - everything optional (deep partial manually)
export const UpdateTrainerSchema = object({
  personalInfo: object({
    givenName: string().optional(),
    middleName: string().optional(),
    surname: string().optional(),
    preferredName: string().optional(),
    email: string().email("Invalid email format").optional(),
    phone: alternatePhoneSchema,
    startingDate: coerce.date().optional(),
    endDate: coerce.date().optional(),
    currentlyWorking: boolean().default(true).optional()
  }).optional(),
  address: object({
    building: string().optional(),
    unit: string().optional(),
    street: string().optional(),
    POBox: string().optional(),
    city: string().optional(),
    state: string().optional(),
    postCode: string().optional(),
    country: string().optional()
  }).optional()
}).optional();

export const TrainerRequestSchema = object({
  body: TrainerSchema,
  query: object({}),
  params: object({})
});

export const UpdateTrainerRequestSchema = object({
  body: UpdateTrainerSchema,
  query: object({}),
  params: object({})
});

export type AddTrainerT = z.infer<typeof TrainerSchema>;
export type UpdateTrainerT = z.infer<typeof UpdateTrainerSchema>;

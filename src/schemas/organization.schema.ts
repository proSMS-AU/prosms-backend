import { z, string, object } from "zod";
import { alternatePhoneSchema, phoneSchema } from "./common.schema";

// Address Schema
const addressSchema = object({
  building: string().optional(),
  unit: string().optional(),
  street: string().min(1, "Street is required"),
  POBox: string().optional(),
  city: string().min(1, "City is required"),
  state: string().min(1, "State is required"),
  postCode: string().min(1, "Postcode is required"),
  country: string().default("Australia")
});

// Organization Schema
export const OrganizationSchema = object({
  rtoId: string().min(1, "RTO ID is required"),
  name: string().min(1, "Organization name is required"),
  address: addressSchema,
  website: string().optional(),
  logoUrl: string().optional(),
  email: string().email("Invalid email address"),
  phone: phoneSchema,
  alternatePhone: alternatePhoneSchema.optional(),
  ABN: string({ error: "ABN is required" }).min(1, "ABN must contain at least 1 character")
});

export const OrganizationCreateRequestSchema = object({
  body: OrganizationSchema,
  query: object({}),
  params: object({})
});

export const OrganizationUpdateRequestSchema = object({
  body: OrganizationSchema.partial(),
  query: object({}),
  params: object({})
});

export type IOrganization = z.infer<typeof OrganizationSchema>;
export type ICreateOrganization = z.infer<typeof OrganizationCreateRequestSchema>;
export type IUpdateOrganization = z.infer<typeof OrganizationUpdateRequestSchema>;

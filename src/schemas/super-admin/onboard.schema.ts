/* eslint-disable @typescript-eslint/no-explicit-any */

import { object, z, array } from "zod";
import { OrganizationSchema } from "../organization.schema";
import { QualificationSchema } from "../qualification.schema";
import { UnitSchema } from "../unit.schema";

export const sendOnboardUrlSchema = z.object({
  body: z.object({
    rto: z
      .string({
        error: "RTO is required"
      })
      .min(1, "RTO cannot be empty"),

    email: z
      .string({
        error: "Email is required"
      })
      .email("Please provide a valid email address")
      .toLowerCase()
      .trim()
  })
});

export const verifyOnboardTokenSchema = z.object({
  query: z.object({
    token: z.string().min(1, "Token is required")
  })
});

export const AuthSchema = z.object({
  email: z.string().email("Please provide a valid email address").toLowerCase().trim(),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  name: z.string().min(1, "Name is required")
});

export const RegisterOrganizationSchema = object({
  organization: OrganizationSchema,
  auth: AuthSchema,
  // Qualifications & units are NOT sent by the client anymore. The server
  // hydrates them from training.gov by RTO at register time, so the request
  // body stays small regardless of how large the RTO's scope is. Kept optional
  // for backward compatibility with any older client build.
  qualifications: array(QualificationSchema).optional(),
  units: array(UnitSchema).optional()
});

export const RegisterOrganizationCreateRequestSchema = object({
  body: RegisterOrganizationSchema,
  query: object({}),
  params: object({})
});

export type SendOnboardUrlInput = z.infer<typeof sendOnboardUrlSchema>["body"];
export type VerifyOnboardTokenInput = z.infer<typeof verifyOnboardTokenSchema>["query"];

export interface TokenPayload {
  rto: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface RegisterOrganizationInput {
  organization: {
    ABN: string;
    rtoId: string;
    name: string;
    email: string;
    phone: {
      countryCode: string;
      number: string;
      formattedNumber: string;
    };
    alternatePhone?: {
      countryCode?: string;
      number?: string;
      formattedNumber?: string;
    };
    website?: string;
    logoUrl?: string;
    address: {
      country: string;
      state: string;
      city: string;
      postCode: string;
      building?: string;
      unit?: string;
      street: string;
      POBox?: string;
    };
  };
  auth: {
    email: string;
    password: string;
    name: string;
  };
  // Optional & unused for new clients — server hydrates these from training.gov.
  qualifications?: Array<{
    code: string;
    title: string;
    status: string;
    latestReleaseInfo?: any;
  }>;
  units?: Array<{
    qualificationCode: any;
    code: string;
    title: string;
    status: string;
    unitType?: string;
    qualificationId?: string;
  }>;
}

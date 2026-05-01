import { boolean, object, string } from "zod";

export const phoneSchema = object({
  countryCode: string({error:"Country code is required"}).min(1, "Country code is required"),
  number: string({error:"phone number is required"}).regex(/^\d{8,15}$/, "Provide a valid phone number"),
  formattedNumber: string().optional()
});
export const alternatePhoneSchema = object({
  countryCode: string().optional(),
  number: string().optional(),
  formattedNumber: string().optional()
}).optional();

export const addressSchema = object({
  addressLine1: string({
    error: "Address Line 1 is required"
  }),
  addressLine2: string().optional(),
  country: string().optional(),
  city: string().optional(),
  state: string().optional(),
  zipCode: string().optional()
});

export const authSchema = object({
  name: string({
    error: "Name is required"
  }).min(3, "Name must be at least 3 characters long"),
  email: string({
    error: "Email is required"
  }).email("Invalid email address"),
  password: string({
    error: "Password is required"
  }).min(6, "Password must be at least 6 characters long"),
  profileImage: string().optional(),
  isTempPassChanged: boolean().optional()
});

export const loginSchema = object({
  body: object({
    email: string({
      error: "Email is required"
    }).email("Invalid email address"),
    password: string({
      error: "Password is required"
    }).min(6, "Password must be at least 6 characters long")
  }),
  query: object({}).optional(),
  params: object({}).optional()
});

import { z } from "zod";

export const configureRTOForUSISchema = z.object({
  body: z.object({
    ssid: z.string().nonempty("SSID is required"),
    ramRelationshipStatus: z.enum(["active", "inactive", "pending", "terminated"], {
      message: "RAM relationship status must be one of active, inactive, pending, or terminated"
    }),
    ramAuthorizationDate: z.string().nonempty("RAM authorization date is required"),
    ramExpiryDate: z.string().nonempty("RAM expiry date is required")
  })
});

export type ConfigureRTOForUSIInputType = z.infer<typeof configureRTOForUSISchema>["body"];

export const verifyUSIWithStudentInfoSchema = z.object({
  body: z.object({
    usi: z.string().nonempty("USI is required"),
    firstName: z.string().optional(),
    familyName: z.string().nonempty("Family name is required"),
    dateOfBirth: z.string().nonempty("Date of birth is required")
  })
});
export type VerifyUSIWithStudentInfoInputType = z.infer<typeof verifyUSIWithStudentInfoSchema>["body"];

export const verifyUSIWithStudentIdSchema = z.object({
  body: z.object({
    usi: z.string().nonempty("USI is required"),
    studentId: z.string().nonempty("Student ID is required")
  })
});

export type VerifyUSIWithStudentIdInputType = z.infer<typeof verifyUSIWithStudentIdSchema>["body"];

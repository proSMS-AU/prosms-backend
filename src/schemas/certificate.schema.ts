import { z, string, object, array } from "zod";

// export const GenerateCertificateRequestSchema = object({
//   body: object({
//     classId: string().min(1, "Class ID is required"),
//     templateId: string().min(1, "Template ID is required"),
//     generatingDate: string().optional(),
//     students: array(string({ error: "Student ID is required" }))
//       .min(1, "At least one student is required")
//       .max(5, "Maximum 5 students allowed")
//   })
// });
export const GenerateCertificateRequestSchema = object({
  body: object({
    classId: string().min(1, "Class ID is required"),
    templateId: string().min(1, "Template ID is required"),
    students: array(
      object({
        id: string().min(1, "Student ID is required"),
        generatingDate: string().optional()
      })
    )
      .min(1, "At least one student is required")
      .max(5, "Maximum 5 students allowed")
  })
});
export type GenerateCertificateT = z.infer<typeof GenerateCertificateRequestSchema>["body"];

export const certificateSendSchema = object({
  body: object({
    certificateId: string().min(1, "CertificateId is required"),
    email: string().email("Please provide a valid email address").toLowerCase().trim()
  })
});

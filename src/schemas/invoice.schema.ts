import { z, string, object, array, number } from "zod";

export const AutoInvoiceStudentSnapshot = object({
  id: string().min(1, "Student ID is required"),
  name: string().min(1, "Student name is required"),
  email: string().min(1, "Student email is required"),
  phone: string().min(1, "Student phone is required"),
  address: object({
    street: string().min(1, "Street is required"),
    city: string().min(1, "City is required"),
    state: string().min(1, "State is required"),
    postcode: string().min(1, "Postcode is required"),
    country: string().min(1, "Country is required")
  })
});

export const GenerateAutoInvoiceRequestSchema = z.object({
  body: object({
    classIds: array(z.string()).min(1, "At least one class ID is required"),
    templateId: string().min(1, "Template ID is required"),
    studentId: string().min(1, "Student ID is required"),
    studentSnapshot: AutoInvoiceStudentSnapshot,
    createdBy: z.string().min(1, "Created by is required")
  })
});

export type AutoInvoiceStudentSnapshotT = z.infer<typeof AutoInvoiceStudentSnapshot>;
export type GenerateAutoInvoiceRequestT = z.infer<typeof GenerateAutoInvoiceRequestSchema>["body"];

export const GenerateManualInvoiceRequestSchema = z.object({
  body: object({
    templateId: z.string().min(1, "Template ID is required"),
    createdBy: z.string().min(1, "Created by is required"),
    invoiceDate: z.string().min(1, "Invoice date is required"),
    dueDate: z.string().min(1, "Due date is required"),
    purchaseOrder: z.string().min(1, "Purchase order is required"),
    name: z.string().min(1, "Name is required"),
    address: z.string().min(1, "Address is required"),
    town: z.string().min(1, "Town is required"),
    postcode: z.string().min(1, "Postcode is required"),
    state: z.string().min(1, "State is required"),
    items: array(
      object({
        description: string().min(1, "Description is required"),
        price: number().min(0, "Price must be positive"),
        qty: number().min(1, "Quantity must be at least 1"),
        gst: number().min(0, "GST must be non-negative"),
        amount: number().optional()
      })
    ).min(1, "At least one item is required")
  })
});
export type GenerateManualInvoiceRequestT = z.infer<typeof GenerateManualInvoiceRequestSchema>["body"];

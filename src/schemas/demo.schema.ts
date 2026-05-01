import { object, output, string } from "zod";

export const demoEchoSchema = object({
  body: object({
    property1: string({ error: "Property 1 is required" }),
    property2: string().optional().nullable()
  })
});
export type DemoEchoType = output<typeof demoEchoSchema>["body"];

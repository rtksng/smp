import { z } from "zod";
import { requestApi } from "./client";

export const quoteRequestInputSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  message: z.string().trim().min(10, "Describe SKUs, quantities, and delivery needs.").max(2000),
  mobileNumber: z.string().trim().min(8, "Enter a contact number.").max(24),
  name: z.string().trim().min(2, "Enter your name.").max(120),
  organization: z.string().trim().max(160).nullable().optional()
});

export const quoteRequestSchema = z.object({
  createdAt: z.string(),
  email: z.string(),
  id: z.string(),
  message: z.string(),
  mobileNumber: z.string(),
  name: z.string(),
  organization: z.string().nullable(),
  status: z.string()
});

export type QuoteRequestInput = z.infer<typeof quoteRequestInputSchema>;
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

export function createQuoteRequest(input: QuoteRequestInput) {
  const parsedInput = quoteRequestInputSchema.parse(input);

  return requestApi("/quote-requests", quoteRequestSchema, {
    body: JSON.stringify(parsedInput),
    method: "POST"
  });
}

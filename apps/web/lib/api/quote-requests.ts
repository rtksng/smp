import { z } from "zod";
import { cartSchema } from "./cart";
import { requestApi } from "./client";
import { requestCustomerApi } from "./customer-client";
import { orderSchema } from "./orders";

export const quoteRequestInputSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  message: z
    .string()
    .trim()
    .min(10, "Describe SKUs, quantities, and delivery needs.")
    .max(2000),
  mobileNumber: z.string().trim().min(8, "Enter a contact number.").max(24),
  name: z.string().trim().min(2, "Enter your name.").max(120),
  organization: z.string().trim().max(160).nullable().optional()
});

export const quoteRequestStatusSchema = z.enum([
  "NEW",
  "CONTACTED",
  "QUOTED",
  "ACCEPTED",
  "REJECTED",
  "CONVERTED",
  "CLOSED"
]);

export const quoteRequestItemSchema = z.object({
  lineSubtotal: z.number(),
  lineTotal: z.number(),
  name: z.string(),
  productId: z.string().nullable(),
  quantity: z.number(),
  sku: z.string(),
  taxAmount: z.number(),
  taxRate: z.number(),
  unitPrice: z.number(),
  variantId: z.string().nullable()
});

export const quoteRequestQuotationSchema = z.object({
  items: z.array(quoteRequestItemSchema),
  notes: z.string().nullable(),
  respondedAt: z.string(),
  totals: z.object({
    grandTotal: z.number(),
    shippingTotal: z.number(),
    subtotal: z.number(),
    taxTotal: z.number()
  }),
  validUntil: z.string().nullable()
});

export const quoteRequestCustomerDecisionSchema = z.object({
  decidedAt: z.string(),
  note: z.string().nullable(),
  status: z.enum(["ACCEPTED", "REJECTED"])
});

export const quoteRequestSchema = z.object({
  convertedCartId: z.string().nullable().default(null),
  convertedOrderId: z.string().nullable().default(null),
  createdAt: z.string(),
  customerDecision: quoteRequestCustomerDecisionSchema.nullable().default(null),
  email: z.string(),
  id: z.string(),
  message: z.string(),
  mobileNumber: z.string(),
  name: z.string(),
  organization: z.string().nullable(),
  quotation: quoteRequestQuotationSchema.nullable().default(null),
  status: quoteRequestStatusSchema
});

export const quoteRequestListSchema = z.object({
  items: z.array(quoteRequestSchema),
  pagination: z.object({
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
    limit: z.number(),
    page: z.number(),
    total: z.number(),
    totalPages: z.number()
  })
});

export const quoteDecisionInputSchema = z.object({
  decision: z.enum(["ACCEPTED", "REJECTED"]),
  note: z.string().trim().max(1000).nullable().optional()
});

export const quoteConversionSchema = z.object({
  cart: cartSchema,
  quote: quoteRequestSchema
});

export const quoteOrderConversionSchema = z.object({
  order: orderSchema,
  quote: quoteRequestSchema
});

export type QuoteRequestInput = z.infer<typeof quoteRequestInputSchema>;
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
export type QuoteRequestList = z.infer<typeof quoteRequestListSchema>;
export type QuoteDecisionInput = z.infer<typeof quoteDecisionInputSchema>;
export type QuoteConversion = z.infer<typeof quoteConversionSchema>;
export type QuoteOrderConversion = z.infer<typeof quoteOrderConversionSchema>;

export function createQuoteRequest(input: QuoteRequestInput) {
  const parsedInput = quoteRequestInputSchema.parse(input);

  return requestApi("/quote-requests", quoteRequestSchema, {
    body: JSON.stringify(parsedInput),
    method: "POST"
  });
}

export function listCustomerQuoteRequests(page = 1, limit = 20) {
  return requestCustomerApi("/quote-requests/my", quoteRequestListSchema, {
    query: {
      limit,
      page
    }
  });
}

export function updateQuoteDecision(quoteId: string, input: QuoteDecisionInput) {
  const parsedInput = quoteDecisionInputSchema.parse(input);

  return requestCustomerApi(
    `/quote-requests/my/${encodeURIComponent(quoteId)}/decision`,
    quoteRequestSchema,
    {
      body: JSON.stringify(parsedInput),
      method: "PATCH"
    }
  );
}

export function acceptQuoteRequest(quoteId: string, note?: string | null) {
  return updateQuoteDecision(quoteId, {
    decision: "ACCEPTED",
    note
  });
}

export function rejectQuoteRequest(quoteId: string, note?: string | null) {
  return updateQuoteDecision(quoteId, {
    decision: "REJECTED",
    note
  });
}

export function convertQuoteToCart(quoteId: string) {
  return requestCustomerApi(
    `/quote-requests/my/${encodeURIComponent(quoteId)}/convert-to-cart`,
    quoteConversionSchema,
    {
      method: "POST"
    }
  );
}

export function convertQuoteToOrder(quoteId: string) {
  return requestCustomerApi(
    `/quote-requests/my/${encodeURIComponent(quoteId)}/convert-to-order`,
    quoteOrderConversionSchema,
    {
      method: "POST"
    }
  );
}
